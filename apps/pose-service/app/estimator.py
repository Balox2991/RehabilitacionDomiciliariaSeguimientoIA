"""Envoltorio sobre RTMPose (rtmlib): detección de la persona + 26 puntos del cuerpo incluyendo pies.

Una sola persona: si el detector encuentra varias, se elige la de mayor área (el paciente va al frente).
Los modelos ONNX se descargan la primera vez a ~/.cache/rtmlib y quedan guardados.
"""
from __future__ import annotations

import os
import threading

import numpy as np

from .mapping import to_mediapipe33

MODES = {
    "lightweight": "RTMPose-s (rápido, CPU modesta)",
    "balanced": "RTMPose-m (recomendado: precisión/velocidad)",
    "performance": "RTMPose-x (máxima precisión, lento sin GPU)",
}
DEFAULT_MODE = os.environ.get("POSE_MODE", "balanced")
DEVICE = os.environ.get("POSE_DEVICE", "cpu")  # "cuda" si hay GPU + onnxruntime-gpu


class PoseEstimator:
    def __init__(self, mode: str = DEFAULT_MODE, device: str = DEVICE):
        if mode not in MODES:
            raise ValueError(f"modo desconocido: {mode}")
        from rtmlib import BodyWithFeet  # import perezoso: el servicio arranca aunque falte el modelo

        self.mode = mode
        self.device = device
        self._model = BodyWithFeet(mode=mode, backend="onnxruntime", device=device)
        self._lock = threading.Lock()  # los modelos ONNX de rtmlib no son seguros entre hilos

    def infer(self, frame_bgr: np.ndarray):
        """Devuelve (keypoints(26,2), scores(26,)) de la persona principal, o None si no hay nadie."""
        with self._lock:
            kpts, scores = self._model(frame_bgr)
        if kpts is None or len(kpts) == 0:
            return None
        if len(kpts) > 1:  # varias personas: la de mayor caja
            i = int(np.argmax([np.ptp(k[:, 0]) * np.ptp(k[:, 1]) for k in kpts]))
        else:
            i = 0
        return kpts[i], scores[i]

    def landmarks(self, frame_bgr: np.ndarray):
        h, w = frame_bgr.shape[:2]
        res = self.infer(frame_bgr)
        if res is None:
            return None
        return to_mediapipe33(res[0], res[1], w, h)


_cache: dict[str, PoseEstimator] = {}
_cache_lock = threading.Lock()


def get_estimator(mode: str = DEFAULT_MODE) -> PoseEstimator:
    with _cache_lock:
        if mode not in _cache:
            _cache[mode] = PoseEstimator(mode)
        return _cache[mode]
