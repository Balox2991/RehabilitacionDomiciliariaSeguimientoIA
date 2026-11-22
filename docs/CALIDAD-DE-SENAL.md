# Calidad de la señal: cuándo se puede confiar en un ángulo

Una cámara normal (2D) no mide ángulos de verdad: los estima a partir de puntos del cuerpo que un modelo de IA adivina en cada imagen. Si el cuerpo sale cortado, la persona está lejos o el brazo apunta a la cámara, la estimación falla y el número sale mal sin avisar. En rehabilitación un número falso es peor que ningún número. Por eso la plataforma **mide primero qué tan fiable es la medición y solo muestra ángulos cuando puede respaldarlos**.

Este documento explica la regla, los umbrales, cómo se guarda el resultado y qué falta por validar.

## 1. Qué decide el guardián

El módulo es `apps/tracking-prototype/src/reliability.js`. Es una función pura: recibe el registro de la sesión (formato `telerehab-trace/2`) y el ejercicio, y devuelve un veredicto con sus causas. No usa cámara, red ni DOM, así que la ejecutan igual el navegador, el servidor y las pruebas.

| Veredicto | Qué ve el paciente | Modo en pantalla |
|---|---|---|
| `reliable` | Ángulos y repeticiones normales | `ok` |
| `uncertain` | Ángulos con reserva («≈») y un consejo de encuadre | `approx` |
| `unreliable` | **Sin ángulos ni repeticiones.** Consejo de encuadre y el muñeco de referencia para comparar la postura a ojo | `hidden` |

Regla del veredicto: si falla `visiblePct` o fallan 2 o más comprobaciones, es `unreliable`. Si falla solo una (y no es `visiblePct`), es `uncertain`. Sin fallas, `reliable`.

## 2. Las cinco comprobaciones

| Código | Qué mide | Pasa si | Qué detecta |
|---|---|---|---|
| `visiblePct` | % de cuadros con la articulación visible | ≥ 85 | Cuerpo cortado, objetos delante, mala luz |
| `scale` | Largo del tronco / alto de la imagen | ≥ 0.12 | Persona muy lejos o muy pequeña |
| `limbVar` | Variación del largo de los segmentos medidos (p90 − p10 sobre la mediana) | ≤ 0.40 | Esqueleto deformado: el brazo apunta a la cámara o se cruza con el torso |
| `jumpPct` | % de saltos del ángulo mayores a 35° entre lecturas seguidas (~66 ms) | ≤ 8 | El modelo pierde el punto y salta |
| `implausiblePct` | % de lecturas fuera del rango que esa articulación puede alcanzar | ≤ 3 | Medidas imposibles |

Rangos plausibles (`PLAUSIBLE_RANGE`): rodilla 20–182°, codo 25–182°, hombro (flexión y abducción) 0–185°, elevación de pierna 0–110°.

Cada falla tiene un consejo propio (`ADVICE`) escrito para que la persona pueda arreglarlo: acercarse, girarse de lado, mejorar la luz, despejar el cuerpo.

## 3. Dónde se aplica

1. **En vivo** (`useTracking.js`): se juzgan los últimos 5 segundos (`assessRecent`, mínimo 2,5 s de datos). El modo cambia solo tras 2 lecturas seguidas iguales (`smoothMode`) para que la pantalla no parpadee.
2. **Video subido** (`VideoUpload.jsx`): si el análisis sale `unreliable`, se rechaza el video con el consejo.
3. **Al guardar la sesión** (servidor): el servidor recalcula la calidad desde el registro guardado, que es la fuente de verdad, y no confía en lo que diga el cliente.

## 4. Cómo se guarda y quién lo ve

- Columna `sessions.quality` (migración `007_session_quality.sql`), texto JSON: `{verdict, score, failed[], metrics{}}`. `NULL` significa que la sesión no tiene registro (por ejemplo, las sesiones sembradas de demo).
- `GET /sessions/:id` devuelve `quality` con el consejo ya traducido. `GET /patients/:id/sessions` devuelve `quality_verdict` en cada fila.
- **Asistente de seguimiento:** las sesiones `unreliable` se excluyen del historial que usa `coaching.js`. Un ángulo dudoso no mueve recomendaciones.
- **Fisioterapeuta:** en la ficha, la pestaña Resumen muestra «Mediciones por revisar»; la pestaña Sesiones tiene el filtro «Medición por revisar» y una etiqueta «No fiable» o «≈» junto a la flexión; el análisis de cada sesión muestra el aviso con los consejos.
- **Sesiones viejas:** `node apps/backend/src/backfillQuality.js [ruta a la base]` calcula la calidad de las sesiones con registro y sin calidad. Se puede repetir sin riesgo.

## 5. Evidencia con videos reales

Herramienta: `node apps/pose-service/tools/quality.mjs` (lee `pruebas-videos/out_*/{mediapipe,rtmpose}.json`, con el mismo código del guardián). Resultados de la última corrida, por video, modelo y lado:

| Video | Qué es | Resultado esperado | Obtenido |
|---|---|---|---|
| Elevación de pierna recta, de perfil | Caso bueno | Aceptar | `reliable` en 3 de 4 combinaciones. El cuarto (MediaPipe, lado derecho) quedó `unreliable` con `visiblePct` = 84, a un punto del umbral |
| Flexión de hombro filmada de frente | Brazo apunta a la cámara | Rechazar | `unreliable` en las 4 (`limbVar` 0.52 a 0.81 y `jumpPct` 12 a 14) |
| Sentadilla a una pierna, lejos | Persona muy pequeña | No dar por fiable | `uncertain` en las 4 (`scale` = 0.09) |
| Codo, dos videos | Brazo tapado o fuera de cuadro | Rechazar | `unreliable` en las 8 |

Lectura: el guardián rechazó todo lo que debía rechazar y aceptó la elevación de pierna en la mayoría de los casos. Es evidencia de funcionamiento con **5 videos de internet**, no una validación clínica.

Hallazgo que cambió el diseño: la flexión de hombro de frente falla en los dos modelos. Por eso `shoulder_flexion` se exige de perfil y se añadió `shoulder_abduction` (brazo hacia el lado), que sí se mide de frente. Ver `exerciseSpecs.js`.

## 6. Límites y lo que falta

- **Umbrales orientativos.** Se calibraron con pocos videos. El caso `visiblePct` 84 contra el umbral 85 muestra que están cerca del borde. No son criterio clínico.
- **Sin referencia de goniómetro.** El guardián dice si la señal es creíble, no si el ángulo es exacto. Medir el error real exige el protocolo de `PROTOCOLO-VALIDACION-GONIOMETRO.md`.
- **Cobertura por ejercicio.** Hay video bueno para elevación de pierna. Faltan videos buenos para rodilla sentado, codo de perfil y abducción de frente. Lo ideal es grabarlos con un celular, con consentimiento.
- **Una sola cámara.** El plano de la imagen limita qué se puede medir. El guardián reduce el riesgo, no lo elimina.
- **Seguimiento.** Cuando haya más videos y goniómetro, volver a ajustar `THRESHOLDS` y repetir `quality.mjs`. Los resultados de arriba deben actualizarse con cada cambio.
