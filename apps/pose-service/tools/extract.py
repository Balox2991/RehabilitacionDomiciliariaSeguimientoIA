"""Extrae los 33 puntos de un video con los DOS modelos (RTMPose y MediaPipe) a la misma cadencia, para compararlos.

Uso:  python tools/extract.py video.mp4 salida_dir [--mediapipe-model ruta/pose_landmarker_full.task]
Genera salida_dir/rtmpose.json y salida_dir/mediapipe.json  (formato: {width,height,step_ms,frames:[{t_ms,landmarks}]}).
Luego:  node tools/compare.mjs salida_dir knee_flexion
"""
import argparse
import json
import os
import sys
import time

import cv2
import mediapipe as mp

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.estimator import get_estimator  # noqa: E402
from app.video import iter_frames  # noqa: E402


def run_mediapipe(video, model_path, step_ms):
    opts = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=model_path),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.6, min_pose_presence_confidence=0.6, min_tracking_confidence=0.6,
    )
    frames, info = [], None
    with mp.tasks.vision.PoseLandmarker.create_from_options(opts) as lm:
        for item in iter_frames(video, step_ms=step_ms):
            if info is None:
                info = item
                continue
            rgb = cv2.cvtColor(item["frame"], cv2.COLOR_BGR2RGB)
            res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), item["t_ms"])
            pts = None
            if res.pose_landmarks:
                pts = [{"x": round(p.x, 5), "y": round(p.y, 5), "z": round(p.z, 5), "visibility": round(p.visibility, 4)} for p in res.pose_landmarks[0]]
            frames.append({"t_ms": item["t_ms"], "landmarks": pts})
    return info, frames


def run_rtmpose(video, mode, step_ms):
    model = get_estimator(mode)
    frames, info = [], None
    for item in iter_frames(video, step_ms=step_ms):
        if info is None:
            info = item
            continue
        frames.append({"t_ms": item["t_ms"], "landmarks": model.landmarks(item["frame"])})
    return info, frames


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--mediapipe-model", default="pose_landmarker_full.task")
    ap.add_argument("--rtm-mode", default="balanced")
    ap.add_argument("--step-ms", type=int, default=66)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for name, fn in (("mediapipe", lambda: run_mediapipe(a.video, a.mediapipe_model, a.step_ms)),
                     ("rtmpose", lambda: run_rtmpose(a.video, a.rtm_mode, a.step_ms))):
        t0 = time.time()
        info, frames = fn()
        # tamaño tras el reescalado de iter_frames: las coordenadas ya están normalizadas, solo importa la proporción
        with open(os.path.join(a.out, f"{name}.json"), "w") as f:
            json.dump({"model": name, "width": info["width"], "height": info["height"], "step_ms": a.step_ms, "frames": frames}, f)
        seen = sum(fr["landmarks"] is not None for fr in frames)
        print(f"{name}: {len(frames)} cuadros, persona en {seen}, {time.time() - t0:.1f} s")
