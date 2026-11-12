import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import estimator as est
from app import main
from app.mapping import MEDIAPIPE_FROM_HALPE, to_mediapipe33


class FakeModel:
    """Sustituye a RTMPose: siempre 've' una persona fija. Permite probar la API sin descargar modelos."""
    def landmarks(self, frame):
        h, w = frame.shape[:2]
        kp = np.tile(np.array([[w * 0.5, h * 0.5]]), (26, 1))
        return to_mediapipe33(kp, np.full(26, 0.9), w, h)


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(est, "get_estimator", lambda mode=None: FakeModel())
    monkeypatch.delenv("POSE_API_KEY", raising=False)
    return TestClient(main.app)


def jpeg(w=64, h=48):
    ok, buf = cv2.imencode(".jpg", np.zeros((h, w, 3), np.uint8))
    return buf.tobytes()


def video(tmp_path, n=20, fps=30):
    path = str(tmp_path / "v.avi")
    wr = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    for _ in range(n):
        wr.write(np.zeros((48, 64, 3), np.uint8))
    wr.release()
    return path


def test_mapping_tiene_33_puntos_y_solo_inventa_con_visibilidad_cero():
    kp = np.arange(52, dtype=float).reshape(26, 2)
    out = to_mediapipe33(kp, np.full(26, 0.8), 100, 100)
    assert len(out) == 33
    for (src, _), p in zip(MEDIAPIPE_FROM_HALPE, out):
        assert (p["visibility"] > 0) == (src is not None)
    assert out[27]["x"] == pytest.approx(kp[15][0] / 100, abs=1e-4)  # tobillo izquierdo
    assert out[31]["x"] == pytest.approx(kp[20][0] / 100, abs=1e-4)  # punta del pie izquierdo


def test_health_y_models(client):
    assert client.get("/health").json()["ok"] is True
    assert {m["mode"] for m in client.get("/models").json()["models"]} == {"lightweight", "balanced", "performance"}


def test_frame(client):
    r = client.post("/pose/frame", files={"image": ("a.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 200 and len(r.json()["landmarks"]) == 33
    assert client.post("/pose/frame", files={"image": ("a.jpg", b"no es imagen", "image/jpeg")}).status_code == 422
    assert client.post("/pose/frame", files={"image": ("a.jpg", jpeg(), "image/jpeg")}, data={"mode": "x"}).status_code == 422


def test_video_muestrea_a_la_cadencia_pedida(client, tmp_path):
    with open(video(tmp_path, n=30, fps=30), "rb") as f:
        r = client.post("/pose/video", files={"video": ("v.avi", f, "video/x-msvideo")}, data={"step_ms": "100"})
    body = r.json()
    assert r.status_code == 200, body
    assert body["frames_with_person"] == body["frames_total"] == 10  # 1 s de video, un cuadro cada 100 ms
    ts = [fr["t_ms"] for fr in body["frames"]]
    assert ts[0] == 0 and all(b - a >= 99 for a, b in zip(ts, ts[1:]))
    assert all(len(fr["landmarks"]) == 33 for fr in body["frames"])


def test_video_invalido_y_limites(client, tmp_path, monkeypatch):
    r = client.post("/pose/video", files={"video": ("v.mp4", b"basura", "video/mp4")})
    assert r.status_code == 422
    with open(video(tmp_path), "rb") as f:
        assert client.post("/pose/video", files={"video": ("v.avi", f, "video/x-msvideo")}, data={"step_ms": "5"}).status_code == 422
    monkeypatch.setattr(main, "MAX_VIDEO_BYTES", 10)
    with open(video(tmp_path), "rb") as f:
        assert client.post("/pose/video", files={"video": ("v.avi", f, "video/x-msvideo")}).status_code == 413


def test_api_key(client, monkeypatch):
    monkeypatch.setenv("POSE_API_KEY", "secreta")
    img = {"image": ("a.jpg", jpeg(), "image/jpeg")}
    assert client.get("/health").status_code == 200  # el health queda abierto
    assert client.post("/pose/frame", files=img).status_code == 401
    assert client.post("/pose/frame", files=img, headers={"x-api-key": "mala"}).status_code == 401
    assert client.post("/pose/frame", files=img, headers={"x-api-key": "secreta"}).status_code == 200
