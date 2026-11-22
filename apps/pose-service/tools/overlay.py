"""Dibuja el esqueleto de MediaPipe (verde) y RTMPose (naranja) sobre el video, para ver a ojo cómo se comportan.

Uso:  python tools/overlay.py video.mp4 salida_dir salida.mp4 [--width 960]
Lee salida_dir/mediapipe.json y salida_dir/rtmpose.json (los genera tools/extract.py).
Muestra, por modelo, el ángulo de la cadera-rodilla respecto a la horizontal (elevación de pierna) y el de cadera-rodilla-tobillo.
"""
import argparse
import json
import math
import os

import cv2

BONES = [(11, 12), (11, 23), (12, 24), (23, 24), (11, 13), (13, 15), (12, 14), (14, 16), (23, 25), (25, 27), (24, 26), (26, 28), (27, 31), (28, 32)]
COLORS = {"mediapipe": (80, 220, 80), "rtmpose": (0, 140, 255)}


def pt(lm, i, w, h):
    p = lm[i]
    return (int(p["x"] * w), int(p["y"] * h)), p.get("visibility", 1)


def angle3(a, b, c):
    v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
    n = math.hypot(*v1) * math.hypot(*v2)
    return None if n == 0 else math.degrees(math.acos(max(-1, min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))))


def draw(img, lm, color, w, h, row):
    if not lm:
        cv2.putText(img, "sin persona", (10, 30 + 28 * row), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        return
    for a, b in BONES:
        (pa, va), (pb, vb) = pt(lm, a, w, h), pt(lm, b, w, h)
        if va > 0.4 and vb > 0.4:
            cv2.line(img, pa, pb, color, 3)
    for i in (11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28):
        p, v = pt(lm, i, w, h)
        if v > 0.4:
            cv2.circle(img, p, 5, (255, 255, 255), -1)
    texts = []
    for side, (hip, knee, ank) in (("izq", (23, 25, 27)), ("der", (24, 26, 28))):
        (ph, vh), (pk, vk), (pa, va) = pt(lm, hip, w, h), pt(lm, knee, w, h), pt(lm, ank, w, h)
        if min(vh, vk) > 0.4:
            seg = math.degrees(math.atan2(-(pk[1] - ph[1]), abs(pk[0] - ph[0]) or 1e-6))
            texts.append(f"{side}: muslo {abs(seg):.0f}° vs horiz.".replace("°", " grados"))
        if min(vh, vk, va) > 0.4:
            a = angle3(ph, pk, pa)
            if a is not None:
                texts.append(f"{side}: rodilla {a:.0f} grados")
    for side, (sh, el, wr, hp) in (("izq", (11, 13, 15, 23)), ("der", (12, 14, 16, 24))):
        (ps, vs), (pe, ve), (pw, vw), (ph, vh) = pt(lm, sh, w, h), pt(lm, el, w, h), pt(lm, wr, w, h), pt(lm, hp, w, h)
        if min(vs, ve, vw) > 0.4:
            a = angle3(ps, pe, pw)
            if a is not None:
                texts.append(f"{side}: codo {a:.0f} grados")
        if min(vs, ve, vh) > 0.4:
            a = angle3(ph, ps, pe)
            if a is not None:
                texts.append(f"{side}: hombro {a:.0f} grados")
    cv2.putText(img, " | ".join(texts) or "articulacion no visible", (10, 30 + 28 * row), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("dir")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=960)
    a = ap.parse_args()
    data = {m: json.load(open(os.path.join(a.dir, f"{m}.json"))) for m in ("mediapipe", "rtmpose")}
    cap = cv2.VideoCapture(a.video)
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 25
    step = data["mediapipe"]["step_ms"]
    W0, H0 = int(cap.get(3)), int(cap.get(4))
    W = a.width
    H = int(W * H0 / W0) // 2 * 2
    out = cv2.VideoWriter(a.out, cv2.VideoWriter_fourcc(*"mp4v"), 1000 / step, (W, H))
    n_frames = len(data["mediapipe"]["frames"])
    for k in range(n_frames):
        t = data["mediapipe"]["frames"][k]["t_ms"]
        cap.set(cv2.CAP_PROP_POS_MSEC, t)
        ok, img = cap.read()
        if not ok:
            break
        img = cv2.resize(img, (W, H))
        for row, m in enumerate(("mediapipe", "rtmpose")):
            fr = data[m]["frames"][k] if k < len(data[m]["frames"]) else {"landmarks": None}
            draw(img, fr["landmarks"], COLORS[m], W, H, row)
        cv2.putText(img, "verde = MediaPipe   naranja = RTMPose", (10, H - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        out.write(img)
    out.release()
    print("listo:", a.out, n_frames, "cuadros")
