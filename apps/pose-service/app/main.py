"""Servicio de pose del sistema de telerehabilitación.

Endpoints:
  GET  /health       estado del servicio y modelos cargados
  GET  /models       modelos disponibles
  POST /pose/frame   una imagen (JPEG/PNG) -> 33 puntos (formato MediaPipe)
  POST /pose/video   un video -> serie de cuadros con 33 puntos cada uno

Privacidad: ni imágenes ni videos se guardan; el video se procesa en un archivo temporal que se borra al terminar.
Autenticación: si POSE_API_KEY está definida, todas las rutas (menos /health) exigen la cabecera X-API-Key.
"""
from __future__ import annotations

import hmac
import os
import tempfile
import time

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from . import estimator as est
from .video import iter_frames

SERVICE_VERSION = "1.0.0"
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = int(os.environ.get("POSE_MAX_VIDEO_MB", "150")) * 1024 * 1024

app = FastAPI(title="Telerehab Pose Service", version=SERVICE_VERSION)


def require_key(x_api_key: str | None = Header(default=None)):
    expected = os.environ.get("POSE_API_KEY")
    if expected and not (x_api_key and hmac.compare_digest(x_api_key, expected)):
        raise HTTPException(401, "API key inválida o ausente")


def _estimator(mode: str):
    if mode not in est.MODES:
        raise HTTPException(422, f"mode debe ser uno de {list(est.MODES)}")
    try:
        return est.get_estimator(mode)
    except Exception as e:  # modelo sin descargar / sin red
        raise HTTPException(503, f"no se pudo cargar el modelo '{mode}': {e}")


@app.get("/health")
def health():
    return {"ok": True, "version": SERVICE_VERSION, "loaded": sorted(est._cache.keys()), "default_mode": est.DEFAULT_MODE}


@app.get("/models", dependencies=[Depends(require_key)])
def models():
    return {"default": est.DEFAULT_MODE, "device": est.DEVICE, "keypoints": "mediapipe33",
            "models": [{"mode": m, "description": d} for m, d in est.MODES.items()]}


@app.post("/pose/frame", dependencies=[Depends(require_key)])
async def pose_frame(image: UploadFile = File(...), mode: str = Form(est.DEFAULT_MODE)):
    data = await image.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "imagen demasiado grande (máx. 8 MB)")
    frame = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(422, "no es una imagen válida")
    model = _estimator(mode)
    t0 = time.perf_counter()
    landmarks = model.landmarks(frame)
    return {"model": f"rtmpose-{mode}", "width": frame.shape[1], "height": frame.shape[0],
            "inference_ms": round((time.perf_counter() - t0) * 1000, 1), "landmarks": landmarks}


@app.post("/pose/video", dependencies=[Depends(require_key)])
async def pose_video(video: UploadFile = File(...), mode: str = Form(est.DEFAULT_MODE), step_ms: int = Form(66)):
    if not 33 <= step_ms <= 500:
        raise HTTPException(422, "step_ms debe estar entre 33 y 500")
    model = _estimator(mode)
    suffix = os.path.splitext(video.filename or "")[1][:8] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        size = 0
        with os.fdopen(fd, "wb") as f:
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_VIDEO_BYTES:
                    raise HTTPException(413, f"video demasiado grande (máx. {MAX_VIDEO_BYTES // 2**20} MB)")
                f.write(chunk)
        t0 = time.perf_counter()
        frames, info, seen = [], None, 0
        try:
            for item in iter_frames(path, step_ms=step_ms):
                if info is None:
                    info = item
                    continue
                lm = model.landmarks(item["frame"])
                seen += lm is not None
                frames.append({"t_ms": item["t_ms"], "landmarks": lm})
        except ValueError as e:
            raise HTTPException(422, str(e))
        if info is None or not frames:
            raise HTTPException(422, "el video no tiene cuadros legibles")
        return {"model": f"rtmpose-{mode}", "width": info["width"], "height": info["height"], "fps": round(info["fps"], 2),
                "step_ms": step_ms, "frames_total": len(frames), "frames_with_person": seen,
                "processing_ms": round((time.perf_counter() - t0) * 1000), "frames": frames}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
