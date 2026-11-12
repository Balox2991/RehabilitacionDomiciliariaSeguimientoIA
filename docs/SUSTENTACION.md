# Guía para la sustentación

Documento de trabajo para preparar la defensa: qué se construyó, qué se puede afirmar con evidencia, qué no, el guion de la
demostración y las preguntas que es probable que haga el jurado. Está escrito para ser honesto sobre los límites: **es mejor
que los digas tú primero a que los descubra el jurado.**

## 1. El proyecto en una frase

Sistema de telerehabilitación para pacientes en recuperación de fracturas: el paciente hace sus ejercicios en casa frente a
la cámara del computador o del celular, el sistema **estima el ángulo articular, cuenta repeticiones y detecta compensaciones
de postura**, y el fisioterapeuta ve la evolución de todos sus pacientes en un panel, con alertas y un informe imprimible.

**Qué se puede afirmar con evidencia hoy:** el sistema funciona de punta a punta (cuentas con roles, plan, ejercicio con
cámara o video, análisis, panel, informe) y dos modelos de visión por computador producen señales muy parecidas en el video de
prueba. **Qué NO se puede afirmar todavía:** que la medición sea clínicamente exacta. Eso lo decide la validación contra
goniómetro (`docs/PROTOCOLO-VALIDACION-GONIOMETRO.md`), que está diseñada pero **no ejecutada**.

Frase sugerida para el resumen: *«sistema de telerehabilitación con estimación del movimiento por visión por computador,
con protocolo de validación contra goniómetro definido; las mediciones se presentan como estimaciones con margen de error,
no como diagnóstico»*.

## 2. Arquitectura (resumen)

```
Navegador (React + MediaPipe) ──► API Express :3001 ──► SQLite
        │  guía en vivo, el video NO sale          │  cuentas, permisos, reglas, análisis
        └── (opcional) video ─────────────────────►└──► Servicio de pose :8000 (Python, RTMPose)
```

| Pieza | Qué hace | Dónde |
|---|---|---|
| Web (React 19) | Pantallas del paciente y del fisioterapeuta | `apps/web` |
| Motor de análisis (JavaScript puro) | Ángulos, repeticiones, tempo, fatiga, compensaciones; **el mismo código** corre en el navegador y en el servidor | `apps/tracking-prototype/src` |
| API (Express 5 + SQLite) | Cuentas, permisos, validación, estadísticas, informe | `apps/backend` |
| Servicio de pose (FastAPI + RTMPose) | Análisis opcional de un video con un modelo más pesado; devuelve los 33 puntos del cuerpo | `apps/pose-service` |

Detalle y justificación en `docs/ARQUITECTURA.md`.

## 3. Decisiones de diseño y por qué (las preguntas «¿por qué no…?»)

1. **Dos caminos de medición, uno privado por defecto.** La guía en vivo usa MediaPipe **en el navegador**: el video nunca sale
   del dispositivo (datos de salud, Ley 1581 de 2012). El análisis con RTMPose en servidor es **opcional y con consentimiento
   explícito** en pantalla, y no guarda el video (se procesa en un archivo temporal que se borra).
2. **El ángulo se calcula con geometría, no con una red que «adivine grados».** Es explicable, se puede comparar con un
   goniómetro y se puede defender. Un modelo que predijera grados directamente necesitaría cientos de sesiones medidas con
   goniómetro.
3. **Las recomendaciones y el resumen del informe son reglas, no un modelo de lenguaje.** Un texto inventado por un LLM puede
   afirmar algo clínico que nadie validó, y exigiría enviar datos de salud a un tercero. Las reglas son deterministas, están
   probadas y cada recomendación lleva su «¿por qué?» con los números del paciente. Si se usara un LLM en el futuro, solo
   debería reformular lo que el motor ya decidió, sin datos identificables y con consentimiento.
4. **Honestidad con el error de la cámara.** El sistema no celebra ni alarma por cambios menores a 4° (el margen de error
   que reporta la literatura citada en la aplicación es de unos 3 a 5°), y el informe lo dice cuando un cambio cae dentro de ese margen.
5. **Humano en el circuito.** El asistente *propone* ajustes al fisioterapeuta y solo se aplican si él pulsa «Aplicar», lo que
   deja una nota clínica. En etapa de protección no propone mover la meta.
6. **Seguridad en el servidor, no en la pantalla.** Una política de acceso única decide quién ve qué (el fisioterapeuta solo ve
   a sus pacientes, el paciente solo lo suyo; el administrador gestiona cuentas pero no ve la clínica ajena); contraseñas con
   scrypt; sesiones revocables; bloqueo por intentos; auditoría. Una prueba recorre todas las rutas y comprueba que ninguna
   responde sin sesión.

## 4. Evidencia disponible (con sus límites)

| Evidencia | Qué muestra | Qué NO muestra |
|---|---|---|
| Pruebas automáticas: backend 116, web 99, motor de tracking 138, servicio de pose 6 + 7 de análisis estadístico | Que las reglas, permisos y cálculos se comportan como se diseñó, con datos sintéticos de resultado conocido | Que la cámara mida bien a personas reales |
| Comparación MediaPipe vs RTMPose en un video (`docs/COMPARACION-MODELOS.md`) | En la pierna visible, ambos detectan las mismas 7 repeticiones y su señal se parece (r = 0,997; diferencia media ≈ 4,5° en la flexión máxima). RTMPose es ~15 veces más lento en CPU | Cuál es más exacto (no hay referencia); un solo video, una sola persona, una sentadilla de gimnasio |
| Protocolo de validación contra goniómetro | Cómo se medirá la exactitud, con criterios fijados antes de ver datos | Ningún resultado: no se ha ejecutado con voluntarios |
| Simulaciones del motor de conteo (`docs/FASE-1-TRACKING.md`) | Cómo se eligieron los estimadores del extremo del movimiento y qué errores tienen con señales sintéticas | Desempeño con ruido real de cámara |

## 5. Guion de la demostración (10–12 minutos)

**Preparación (antes de entrar):** ejecutar `iniciar-demo.cmd` (doble clic), esperar «Todo listo» y abrir
`http://localhost:5173`. La contraseña de las cuentas de demostración sale en esa ventana y en
`apps/backend/data/demo-credentials.txt`. **Tener a mano un video corto (10–20 s) de una persona de perfil haciendo el
ejercicio** y haberlo probado antes. La primera vez que se use RTMPose descarga ~140 MB: hacerlo **antes** de la defensa.

| Min | Qué mostrar | Qué decir |
|---|---|---|
| 0–1 | Pantalla de ingreso | Ingreso real con roles; no hay modo demostración abierto |
| 1–3 | Entrar como **paciente** (`andres.mejia@ejemplo.co`): inicio, plan de la semana, logros | El paciente ve solo lo suyo; el asistente le da orientación con su «¿por qué?» |
| 3–6 | «Ver cómo se hace» → «Tengo un video grabado» → elegir motor → subir video | Dos motores: navegador (privado) y RTMPose (más pesado, con consentimiento); el resultado se guarda como una sesión más |
| 6–8 | Cerrar sesión y entrar como **fisioterapeuta** (`camila.restrepo@ejemplo.co`): resumen, alertas, un paciente, la sesión recién subida (muñeco animado) | El fisioterapeuta ve el esqueleto, no a la persona; sugerencias que él decide aplicar |
| 8–9 | Informe del paciente (pestaña Informe) con el resumen redactado | Texto por reglas; dice cuándo un cambio es ruido de la cámara; se imprime a PDF |
| 9–10 | Intento de ver a otro paciente (cambiar el número en la URL) | Responde «no encontrado»: el control de acceso está en el servidor |
| 10–12 | Documento del protocolo y de la comparación | Qué falta: la validación con goniómetro, y por qué es lo que sostiene la afirmación |

**Plan B si algo falla:**
- *Falla la cámara o el video:* usar una sesión ya guardada (los pacientes de demostración traen 126 sesiones) y mostrar el replay.
- *RTMPose tarda o no responde:* elegir «En mi navegador» (el selector deshabilita RTMPose si el servicio no responde).
- *Se cae la red o un servicio:* `iniciar-demo.ps1 -SinPose` levanta todo menos el servicio de pose; todo es local, no necesita internet (salvo la primera descarga de los modelos).
- **Grabar antes un video de pantalla de la demostración completa** como respaldo final.

## 6. Preguntas probables y respuestas honestas

**¿Qué tan preciso es?** Todavía no lo sé con números propios. En la comparación con un video, los dos modelos coinciden entre
sí con una diferencia media de unos 4,5° en la flexión máxima; la literatura que cito reporta errores de 3 a 5° con una cámara.
Dejé el protocolo de validación contra goniómetro listo, con criterios fijados antes de medir, para saberlo con voluntarios.

**¿Por qué dos modelos?** MediaPipe corre en el navegador y protege la privacidad en la guía en vivo. RTMPose es más pesado y
solo tiene sentido para analizar un video después. La comparación existe justamente para decidir si el modelo pesado vale su costo; con un
video no alcanza para decidirlo.

**¿Por qué no usó un modelo de lenguaje (IA generativa) para las recomendaciones?** Es una decisión deliberada: en salud, un
texto generado puede afirmar algo clínico no validado, y enviaría datos sensibles a un tercero. Usé reglas explicables con sus
umbrales visibles y probadas. Podría reformular texto en el futuro, pero nunca decidir.

**¿Cumple la ley?** El diseño toma en cuenta la Ley 1581 de 2012 (consentimiento, mínimo de datos, el video no se guarda) y deja
registro de accesos. **No** es un dispositivo médico ni tiene concepto jurídico: en `docs/CONSIDERACIONES-COLOMBIA.md` están los
puntos a revisar con asesoría antes de usarlo con pacientes reales (habilitación de telemedicina, ubicación de los servidores, contrato con proveedores).

**¿Qué pasa si el paciente se pone mal o hace mal el ejercicio?** El sistema avisa postura y ritmo, y le dice cuándo avisar a su
fisioterapeuta; no da indicaciones clínicas (cargas, rangos, plazos) que el equipo tratante no haya definido. No reemplaza la
valoración presencial.

**¿Funciona en celular?** La interfaz tiene estilos para pantallas pequeñas (barra inferior, columnas que se apilan), pero **no la he
probado en un celular real**: pruébala antes de la defensa si quieres mostrarla así. Para usar la cámara en un celular hace falta HTTPS
al publicarla (requisito del navegador). Una app nativa o PWA queda como trabajo futuro.

**¿Está en producción?** No. Corre en local con datos ficticios. Para publicarla faltan: HTTPS y dominio, base de datos
gestionada, correo de invitación y recuperación de contraseña, y revisión jurídica.

## 7. Limitaciones que debes declarar tú

- La medición es en 2D: se degrada si el paciente gira el cuerpo respecto a la cámara (el sistema pide perfil o frente según el ejercicio).
- Solo 4 ejercicios se miden con cámara (rodilla, codo, hombro, elevación de pierna recta); los demás de la biblioteca son guiados.
- No hay validación en pacientes con fractura (movilidad limitada, yesos, edema) ni con distintos tonos de piel y complexiones.
- Los videos de demostración de los ejercicios son muñecos animados, no videos reales.
- La interfaz no se ha probado en un celular real (solo en escritorio).
- La interfaz no se ha probado en un celular real (solo en escritorio).
- El límite de intentos de ingreso vive en memoria (se reinicia con el servidor) y no hay pantalla para consultar la auditoría.

## 8. Trabajo futuro

Ejecutar la validación contra goniómetro y ajustar umbrales; medición en 3D (`worldLandmarks`); modelo propio de calidad de
repetición entrenado con datos etiquetados por fisioterapeutas; PWA instalable; correo y dominio; despliegue con HTTPS y
base gestionada; videos reales de ejercicios con el equipo de fisioterapia.
