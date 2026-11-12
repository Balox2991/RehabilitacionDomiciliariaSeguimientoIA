# Comparación MediaPipe vs RTMPose (primer experimento)

**Qué es:** una comparación de **acuerdo entre modelos** sobre un solo video. **No mide exactitud**: no hay goniómetro ni
ángulos de referencia, así que no se puede decir cuál modelo se acerca más a la realidad.

## Material

- Video: «Squat and Frontal Raise» (Wikimedia Commons, licencia CC BY 3.0), 640×480, 30 fps, ~28 s, una persona de perfil
  haciendo sentadillas. Ejercicio medido: `knee_flexion` (cadera–rodilla–tobillo).
- MediaPipe: PoseLandmarker `full` (el mismo modelo del navegador), umbrales 0,6, ejecutado en Python.
- RTMPose: RTMPose-m + YOLOX-m (Halpe26), `balanced`, CPU.
- Mismo muestreo (66 ms, 427 cuadros) y **mismo motor de análisis** para ambos (`runPosePass` + `analyzeSession`).
- Reproducir: `python tools/extract.py video.webm salida/ --mediapipe-model pose_landmarker_full.task` y
  `node tools/compare.mjs salida knee_flexion` (en `apps/pose-service`).

## Resultados

| | MediaPipe | RTMPose |
|---|---|---|
| Tiempo de proceso (427 cuadros, CPU) | **8 s** | 121 s (~15× más lento) |
| Pierna cercana a la cámara (izq.): visible | 100 % | 100 % |
| Repeticiones detectadas | 7 | 7 |
| Mejor ángulo por repetición | 41, 40, 39, 136, 40, 40, 40 | 47, 46, 44, 136, 47, 45, 44 |
| Pierna lejana (der.), tapada por el cuerpo: visible | 2 % → 0 repeticiones | 98 % → 6 repeticiones |

Acuerdo en la pierna izquierda (427 cuadros): **r = 0,997**, error medio absoluto 5,4°, RMSE 6,1°, sesgo constante
(MediaPipe − RTMPose) de −4,5°.

## Lectura honesta

1. **Con la pierna a la vista, los dos modelos cuentan lo mismo y su señal es casi idéntica en forma (r = 0,997).** Difieren
   en un desfase casi constante de ~4,5° en la flexión máxima. Con este experimento no se sabe cuál está más cerca del
   valor real; ese desfase es del tamaño del error de cámara que ya cita el proyecto (3–5°).
2. **RTMPose «ve» la pierna tapada; MediaPipe no.** Eso puede ser una ventaja (si acierta) o un riesgo (si inventa una
   articulación oculta con confianza alta). Una confianza alta **no demuestra** que la posición sea correcta: hace falta un
   goniómetro o un etiquetado manual para saberlo.
3. **Costo:** en CPU RTMPose es ~15× más lento. Sirve para el análisis posterior de un video, no para la guía en vivo.
4. La repetición n.º 4 (136° en ambos) es un movimiento distinto al resto; no se revisó a mano qué es.
5. **Limitaciones:** un video, una persona, un ejercicio de gimnasio (sentadilla, no el de un paciente), sin referencia
   clínica. Para una afirmación defendible se necesita la validación con goniómetro y voluntarios (Fase 4).
