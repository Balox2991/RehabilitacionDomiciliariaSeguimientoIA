# Servicio de pose (RTMPose + FastAPI)

Microservicio de visión por computador con endpoints REST. Detecta 26 puntos del cuerpo (incluye talón y punta del pie)
con **RTMPose** (Halpe26, ONNX Runtime) y los devuelve en la convención de **33 puntos de MediaPipe**, de modo que el
motor de análisis del proyecto (ángulos, repeticiones, compensaciones) funciona igual con cualquiera de los dos modelos.

Es **opcional**: la guía en vivo sigue usando MediaPipe en el navegador (el video no sale del dispositivo). Este servicio
es para el **análisis posterior de un video subido**, donde se puede usar un modelo más pesado.

## Ejecutar

```bash
cd apps/pose-service
python -m venv .venv && .venv/Scripts/activate        # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

La primera petición descarga los modelos (~140 MB) a `~/.cache/rtmlib`. Variables: `POSE_MODE` (`lightweight` |
`balanced` | `performance`), `POSE_DEVICE` (`cpu` | `cuda`), `POSE_API_KEY` (si existe, exige `X-API-Key`),
`POSE_MAX_VIDEO_MB` (150).

## Endpoints

| Método y ruta | Qué hace |
|---|---|
| `GET /health` | Estado y modelos cargados |
| `GET /models` | Modelos disponibles |
| `POST /pose/frame` | `image` (JPEG/PNG) → 33 puntos |
| `POST /pose/video` | `video`, `step_ms` (33–500, def. 66) → un cuadro con 33 puntos cada `step_ms` |

Documentación interactiva: `http://localhost:8000/docs`.

## Conexión con el backend

Backend con `POSE_SERVICE_URL=http://localhost:8000` (y `POSE_API_KEY` si la usa):

- `GET /pose/status` → ¿configurado y disponible?
- `POST /pose/analyze-video?exercise_code=knee_flexion&side=left&target_angle=90&mode=balanced`
  con el video como cuerpo (`Content-Type: video/mp4`) → `{ trace, analysis, ... }`. No guarda nada: el cliente guarda
  el `trace` con `POST /patients/:id/sessions`, que lo valida y analiza de nuevo en el servidor.

## Pruebas y medición

`pytest` (6 pruebas, sin descargar modelos). Medido en CPU sin GPU, RTMPose-m: ~0,3 s por cuadro → un video de 30 s a
15 fps tarda ~2,5 min; `lightweight` es más rápido, `cuda` mucho más. **No hay todavía una comparación de precisión contra
MediaPipe ni contra goniómetro** (Fase 4 del plan): hasta entonces no se puede afirmar que sea «mejor» con números.
