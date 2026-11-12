# Protocolo de validación de la medición con cámara contra el goniómetro

Estado: **borrador para revisión del director del proyecto y, si la universidad lo exige, del comité de ética**. Nada de lo que
sigue se ha ejecutado todavía: no hay resultados con voluntarios. Los números marcados como «propuestos» (tamaño de muestra y
criterios de aceptación) son una propuesta razonada que debe confirmar el director antes de recolectar datos, y no deben
cambiarse después de ver los resultados.

## 1. Pregunta y objetivos

**Pregunta principal:** ¿qué tan cerca está el ángulo de flexión que mide el sistema con una sola cámara del ángulo medido con
goniómetro universal por fisioterapeutas, en adultos sanos?

**Objetivos específicos**

1. Estimar el sesgo y los límites de acuerdo (Bland-Altman) entre la cámara y el goniómetro, por ejercicio.
2. Comparar los dos modelos de visión del sistema (MediaPipe, que corre en el navegador, y RTMPose, que corre en el servicio de pose) sobre **los mismos videos**.
3. Medir la confiabilidad del propio goniómetro (dos evaluadores): fija el techo de exactitud que se le puede pedir a la cámara.
4. Medir cuántas mediciones se pierden (articulación poco visible) y en qué condiciones.

**Lo que este estudio NO responde:** no valida el sistema en pacientes con fractura (movilidad limitada, dolor, yesos, edema),
no valida las repeticiones dinámicas ni la detección de compensaciones, y no sustituye una validación clínica. Con voluntarios
sanos se puede afirmar acuerdo con el goniómetro, no utilidad clínica.

## 2. Diseño

Estudio de **concordancia de medidas repetidas** en una sola sesión por voluntario. Se comparan lecturas del goniómetro y de la
cámara tomadas **sobre el mismo sostén estático** del miembro, no durante el movimiento: un goniómetro no puede leerse con
fiabilidad en una articulación que se mueve, y si se leyera en movimiento se mediría la velocidad del evaluador, no la del sistema.

- **Unidad de análisis:** un sostén (el participante mantiene una posición 5 s).
- **Ejercicios (propuestos):** flexión de rodilla (sentado, perfil) y flexión del hombro (de pie, perfil). Son los dos con estudios de validación con una cámara citados en la sección «Evidencia» de la aplicación. Si hay tiempo, flexión de codo.
- **Ángulos objetivo por ejercicio (5, cubren el rango útil):** rodilla 30°, 60°, 90°, 110°, 130° de flexión; hombro 30°, 60°, 90°, 120°, 150°. El orden de los ángulos se **aleatoriza** por participante (tabla generada antes de empezar).
- **Lado:** un lado por participante, asignado al azar y balanceado.
- **Referencia:** promedio de dos evaluadores con el mismo goniómetro, cada uno **ciego** al valor del otro y a lo que mide el sistema.

## 3. Participantes

- **Número propuesto: 20 adultos sanos** (18–45 años) por ejercicio medido, los mismos para ambos ejercicios. Total propuesto: 20 participantes × 2 ejercicios × 5 ángulos = **200 sostenes por modelo**.
- **Justificación del tamaño:** con 200 pares y una desviación de las diferencias de 5°, el error estándar de cada límite de acuerdo es de aproximadamente 0,6° (intervalo de confianza del 95 % de ±1,2°, fórmula de Bland y Altman 1986). Como los 10 sostenes de un mismo participante no son independientes, el intervalo real es más ancho: por eso el análisis incluye un remuestreo por participante y la muestra efectiva se interpreta con cautela. Es una elección de viabilidad y precisión, no un cálculo de potencia con un efecto esperado.
- **Inclusión:** voluntarios sanos, mayores de edad, que firmen el consentimiento informado.
- **Exclusión:** dolor o lesión actual en el miembro evaluado, cirugía del miembro en los últimos 12 meses, limitación conocida de movilidad en esa articulación, embarazo avanzado (por comodidad en las posturas), imposibilidad de mantener las posiciones.
- **Diversidad deseable (no se puede garantizar con 20 personas):** ambos sexos, distintas complexiones y tonos de piel, ropa ajustada y holgada. Hay que registrarlo: la precisión de estos modelos puede variar con esas características y 20 personas solo permiten describirlo, no demostrar que no haya diferencias.

## 4. Ética, consentimiento y datos

- **Marco colombiano:** Resolución 8430 de 1993 del Ministerio de Salud (investigación en salud con seres humanos; este estudio se clasificaría como de riesgo mínimo, a confirmar con el comité), y Ley 1581 de 2012 (datos personales). **Confirmar con la universidad** si requiere aval de un comité de ética y qué formato usa; no recolectar datos antes de tenerlo.
- **Consentimiento informado por escrito**, que explique: objetivo, que es voluntario y que puede retirarse sin consecuencia, los posibles molestias (mantener posturas 5 s, contacto del evaluador para ubicar el goniómetro), qué datos se guardan, por cuánto tiempo y quién accede.
- **Qué se guarda:** se recomienda **guardar solo los puntos del cuerpo (números), no el video**. Si por razones de análisis se conservan los videos, hace falta consentimiento específico para ello, almacenamiento cifrado, acceso restringido y fecha de borrado. Los participantes se identifican con un código (P01, P02…); la tabla que une el código con el nombre se guarda aparte y se destruye al terminar.
- **Pendiente de decidir:** si se publican datos anonimizados junto con la tesis (requiere permiso expreso en el consentimiento).

## 5. Materiales y montaje

- **Goniómetro universal de plástico o metal de 30 cm**, el mismo para todos los participantes y evaluadores.
- **Evaluadores:** dos personas con formación en fisioterapia (idealmente estudiantes avanzados o profesionales). Antes del estudio, una sesión de práctica conjunta de 30–60 min para unificar el método de ubicación del goniómetro. Cada evaluador usa los mismos puntos de referencia óseos: *rodilla* — trocánter mayor, cóndilo lateral del fémur, maléolo lateral; *hombro* — acromion, línea media del brazo hacia el epicóndilo lateral, línea axilar media del tronco.
- **Cámara:** teléfono o webcam como la que usaría un paciente (no una cámara profesional), **fija sobre trípode**, lente a la altura de la articulación evaluada, a 2,5–3 m del participante, plano **perpendicular** al plano del movimiento (vista de perfil), 1080p y 30 fps, sin zoom digital. Las marcas del goniómetro se hacen con **calcomanías pequeñas**: registrar si quedan visibles en el video (podrían ayudar al modelo y sesgar el resultado a favor); idealmente hacer una versión **sin marcas visibles** (ubicar los puntos óseos por palpación) y compararlas.
- **Entorno:** fondo despejado, luz uniforme sin contraluz, ropa que deje ver la articulación y contraste con el fondo. Para un subconjunto, repetir con condiciones menos ideales (luz tenue, ropa holgada) para describir la pérdida de precisión.
- **Soporte para fijar el ángulo:** una **referencia física** que ayude al participante a sostener el ángulo (p. ej., una tabla o un tope ajustable), de modo que la posición no cambie mientras los dos evaluadores miden.
- **Cronómetro y hoja de registro** (plantilla en `docs/validacion/plantilla-registro.csv`).

## 6. Procedimiento

**Antes (por voluntario, ~5 min):** consentimiento, código, datos básicos (edad, sexo, altura, peso, miembro dominante, ropa), asignación del lado y orden de ángulos (tabla aleatoria), calentamiento corto.

**Por cada sostén (5 ángulos × 2 ejercicios = 10 sostenes, ~1–2 min cada uno):**

1. El participante lleva el miembro al ángulo objetivo apoyado en la referencia física y lo **mantiene 5 s**.
2. El auxiliar de cámara inicia la grabación y dice «ahora» en voz alta (una marca de tiempo audible en el video); anota el número de sostén.
3. Evaluador 1 lee el goniómetro y lo dice en voz baja al anotador (el evaluador 2 no lo oye). Evaluador 2 hace lo mismo.
4. Si el participante se movió o el sostén duró menos de 5 s, **se repite** y se anota el intento descartado.
5. Descanso de 20–30 s entre sostenes para evitar fatiga.

**Después:** revisar que todos los videos abren y que la hoja está completa **antes** de que el participante se vaya. Repetir en el momento lo que falte.

**Confiabilidad intra-evaluador (subconjunto):** en 10 de los 20 participantes, cada evaluador repite una segunda lectura de cada sostén (misma posición, sin ver su lectura anterior).

**Duración estimada por participante:** 30–40 min.

## 7. Datos y procesamiento

1. Del video se extraen los 33 puntos del cuerpo con **ambos modelos** (`apps/pose-service/tools/extract.py`).
2. Para cada sostén se define a mano la **ventana estable**: los 3 s centrales de los 5 s, ubicados con la marca audible. Se anota en un archivo `sostenes.csv` (`hold_id,start_s,end_s`).
3. `apps/pose-service/tools/holds.mjs` calcula, por modelo y por sostén, la **mediana del ángulo** dentro de la ventana (solo cuadros con la articulación visible, visibilidad ≥ 0,5) y la fracción de cuadros utilizables. El ángulo sale como **flexión clínica** (0° = extendido), igual que el goniómetro.
4. Las lecturas del goniómetro, el ángulo de cámara y la visibilidad se reúnen en un solo CSV con las columnas de la plantilla.
5. Un sostén se **excluye** si falta una lectura o si la articulación fue visible en menos del 50 % de la ventana. **Todas las exclusiones se cuentan y se informan** (la tasa de pérdida es un resultado en sí).
6. Quien analiza los datos **no corrige** ángulos a mano ni elimina valores atípicos sin criterio escrito antes de empezar.

## 8. Análisis estadístico y criterios de aceptación (propuestos)

El análisis lo ejecuta `node apps/pose-service/tools/validate.mjs registro.csv` y está cubierto por pruebas con datos simulados de verdad conocida. Se reportan siempre **todas** las métricas, aunque alguna salga mal.

| Medida | Qué es | Criterio propuesto (por modelo y ejercicio) |
|---|---|---|
| Sesgo | Diferencia media cámara − goniómetro, con IC95 | \|sesgo\| ≤ 3° |
| Límites de acuerdo 95 % | Sesgo ± 1,96 DE de las diferencias (Bland-Altman), con IC95 | semiancho ≤ 10° |
| Error absoluto medio (MAE) | Promedio de \|cámara − goniómetro\| | ≤ 5° |
| ICC(2,1) | Acuerdo absoluto cámara vs. referencia (Koo y Li 2016) | ≥ 0,90 |
| Sesgo proporcional | Pendiente de la diferencia contra la media del par | se reporta, sin umbral |
| Dentro de ±5° y de ±10° | Porcentaje de sostenes | se reporta, sin umbral |

- **Por qué estos umbrales:** el goniómetro tiene por sí mismo una variabilidad entre evaluadores del orden de pocos grados (se mide en este mismo estudio, objetivo 3), y la aplicación ya trata como ruido lo menor a 4° (`noiseFloorDeg`). Pedir a la cámara un error medio ≤ 5° y límites de ±10° es **una barra razonable pero discutible**: el director debe confirmarla. Si el techo medido del goniómetro resulta peor, los umbrales se discuten **antes** de mirar los datos de la cámara.
- **Incertidumbre:** además del IC de Bland-Altman se calcula un **remuestreo por participante** (2 000 réplicas), porque los sostenes de una misma persona no son independientes.
- **Comparación MediaPipe vs RTMPose:** error absoluto de cada modelo contra la referencia en los mismos sostenes, con prueba de rangos con signo de Wilcoxon pareada. **Hipótesis nula: no hay diferencia.** Si no se rechaza, se informa que no se encontró diferencia en esta muestra (no que sean equivalentes). Se informan además el tiempo de proceso y los requisitos de cada uno: RTMPose tarda ~15 veces más en CPU, por lo que una mejora pequeña de precisión puede no justificarlo para la guía en vivo.
- **Estratos descriptivos:** por ejercicio, por rango de ángulo, por sexo, con y sin marcas visibles, y por condición de luz. Con 20 personas son **descriptivos, no concluyentes**.
- **Qué hacer si no se cumple:** se informa tal cual. Un resultado negativo («el sistema solo alcanza ±15° en hombro») también es una contribución, y define para qué ejercicios puede usarse el sistema como orientación y para cuáles no. La aplicación debe mostrar esa limitación al fisioterapeuta.

## 9. Amenazas a la validez y cómo se manejan

| Amenaza | Manejo |
|---|---|
| Los evaluadores ven lo que mide el sistema | Ciegos: el sistema no se consulta hasta terminar la recolección |
| Un evaluador recuerda su lectura anterior | Segunda lectura en orden distinto y sin ver la anterior |
| El participante cambia de posición entre lecturas | Referencia física + repetir el sostén si se movió |
| Las calcomanías ayudan a la cámara | Registrar y comparar con y sin marcas visibles |
| Cámara no perpendicular | Marcas en el piso para el trípode y verificación con nivel |
| Ventana de análisis escogida a conveniencia | Se define con la marca audible y **antes** de calcular el ángulo |
| Dependencia entre sostenes de una persona | Remuestreo por participante |
| Voluntarios sanos con rango normal | Se reconoce como límite: no generaliza a pacientes con movilidad reducida |
| El goniómetro no es la verdad absoluta | Se mide su confiabilidad y se interpreta el resultado contra ese techo |

## 10. Cronograma propuesto

| Semana | Actividad |
|---|---|
| 1 | Aprobación del director y, si aplica, del comité de ética; compra o préstamo del goniómetro y trípode; elaboración del consentimiento |
| 2 | Capacitación de evaluadores, ensayo piloto con 2–3 personas (probar el montaje y el flujo, **no** se incluyen en el análisis) y ajustes |
| 3–4 | Recolección con los 20 voluntarios |
| 5 | Extracción con ambos modelos, definición de ventanas y construcción del CSV |
| 6 | Análisis, tablas y figuras (Bland-Altman) y redacción de resultados |

## 11. Entregables

Registro de datos anonimizado, informe de resultados con todas las métricas de la sección 8 (incluidas las que no cumplan), figuras de Bland-Altman por modelo y ejercicio, tasa de exclusión, y una sección de limitaciones. La salida de `validate.mjs` se pega tal cual en el anexo para que se pueda reproducir.

## 12. Decisiones que debe tomar el director antes de empezar

1. ¿Se requiere aval de comité de ética? ¿Con qué formato?
2. ¿Se confirman los 20 participantes y los dos ejercicios (rodilla y hombro), o se agrega el codo?
3. ¿Se aceptan los criterios de la sección 8 o se cambian? (Antes de recolectar.)
4. ¿Se guardan solo los puntos del cuerpo, o también los videos (con consentimiento específico)?
5. ¿Quiénes serán los dos evaluadores y cuántos goniómetros hay disponibles?

## Referencias (verificar la cita exacta antes de incluirlas en la tesis)

- Bland JM, Altman DG. Statistical methods for assessing agreement between two methods of clinical measurement. *Lancet*. 1986.
- Koo TK, Li MY. A guideline of selecting and reporting intraclass correlation coefficients for reliability research. *J Chiropr Med*. 2016.
- Norkin CC, White DJ. *Measurement of Joint Motion: A Guide to Goniometry*. F. A. Davis (técnica de ubicación del goniómetro).
- Ministerio de Salud de Colombia. Resolución 8430 de 1993. Ley 1581 de 2012.
- Estudios de validación de la medición con cámara citados en la aplicación (sección «Evidencia»): Barzegar 2024, Russo 2026, tal como los recoge `docs/ARQUITECTURA.md` (el propio documento pide mostrar lo que cada estudio no demuestra).
