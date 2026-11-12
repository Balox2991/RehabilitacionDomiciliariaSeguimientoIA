"""Lectura de un video cuadro a cuadro a una cadencia fija (por defecto ~15 fps, igual que el análisis del navegador)."""
from __future__ import annotations

import cv2

MAX_SECONDS = 180
MAX_SIDE = 960  # se reduce el cuadro para acelerar la inferencia; las coordenadas salen normalizadas igual


def iter_frames(path: str, step_ms: int = 66, max_seconds: int = MAX_SECONDS):
    """Primer elemento: info del video. Siguientes: {"t_ms", "frame"} cada ~step_ms."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("no se pudo abrir el video (formato no soportado o archivo dañado)")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total > 0 and total / fps > max_seconds:
            raise ValueError(f"el video dura más de {max_seconds} s")
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        scale = min(1.0, MAX_SIDE / max(width, height)) if width and height else 1.0
        yield {"fps": fps, "width": width, "height": height}
        next_t = 0.0
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            t = idx / fps * 1000
            idx += 1
            if t > max_seconds * 1000:
                raise ValueError(f"el video dura más de {max_seconds} s")
            if t + 1e-6 < next_t:
                continue
            next_t += step_ms
            if scale < 1.0:
                frame = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            yield {"t_ms": int(round(t)), "frame": frame}
    finally:
        cap.release()
