"""Conversión Halpe26 (RTMPose) -> 33 puntos de MediaPipe.

El motor de análisis del proyecto (apps/tracking-prototype) espera la convención de MediaPipe: 33 puntos con
x, y normalizados 0-1, z y visibility. Este módulo traduce la salida de RTMPose a ese formato para que el resto del
sistema (ángulos, repeticiones, compensaciones, replay) funcione sin cambios con cualquiera de los dos modelos.
"""
from __future__ import annotations

import numpy as np

# Halpe26: 0 nariz, 1-2 ojos, 3-4 orejas, 5-6 hombros, 7-8 codos, 9-10 muñecas, 11-12 caderas, 13-14 rodillas,
# 15-16 tobillos, 17 cabeza, 18 cuello, 19 pelvis, 20-21 dedo gordo, 22-23 dedo chico, 24-25 talón.
# Lista indexada por punto MediaPipe: (índice Halpe26 o None, índice de respaldo para la posición si no existe).
MEDIAPIPE_FROM_HALPE: list[tuple[int | None, int | None]] = [
    (0, None),                    # 0 nose
    (1, 0), (1, 0), (1, 0),       # 1-3 ojo izquierdo (interno, centro, externo)
    (2, 0), (2, 0), (2, 0),       # 4-6 ojo derecho
    (3, None), (4, None),         # 7-8 orejas
    (None, 0), (None, 0),         # 9-10 comisuras de la boca (no existen en Halpe26)
    (5, None), (6, None),         # 11-12 hombros
    (7, None), (8, None),         # 13-14 codos
    (9, None), (10, None),        # 15-16 muñecas
    (None, 9), (None, 10),        # 17-18 meñiques (sin modelo de manos: se ubican en la muñeca)
    (None, 9), (None, 10),        # 19-20 índices
    (None, 9), (None, 10),        # 21-22 pulgares
    (11, None), (12, None),       # 23-24 caderas
    (13, None), (14, None),       # 25-26 rodillas
    (15, None), (16, None),       # 27-28 tobillos
    (24, None), (25, None),       # 29-30 talones
    (20, None), (21, None),       # 31-32 punta del pie (dedo gordo)
]
assert len(MEDIAPIPE_FROM_HALPE) == 33


def to_mediapipe33(keypoints: np.ndarray, scores: np.ndarray, width: int, height: int):
    """keypoints (26,2) en píxeles, scores (26,) -> lista de 33 dicts {x,y,z,visibility} normalizados 0-1."""
    out = []
    for src, fallback in MEDIAPIPE_FROM_HALPE:
        if src is not None:
            px, py = keypoints[src]
            vis = float(scores[src])
        else:
            px, py = keypoints[fallback]
            vis = 0.0  # inventado a partir de otro punto: nunca debe pasar por visible
        vis = max(0.0, min(1.0, vis))
        out.append({
            "x": round(float(px) / width, 5),
            "y": round(float(py) / height, 5),
            "z": 0.0,
            "visibility": round(vis, 4),
        })
    return out
