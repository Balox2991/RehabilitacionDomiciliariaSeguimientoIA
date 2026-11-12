# Manual de instalación y uso

## 1. Requisitos

| Componente | Versión | Para qué |
|---|---|---|
| Node.js | 22.5 o superior | API y web (la API usa `node:sqlite`) |
| Python | 3.10 o superior | Solo para el servicio de pose (opcional) |
| Navegador | Chrome o Edge reciente | Cámara y MediaPipe (WebGL/WASM) |
| Windows 10/11 | — | El lanzador es PowerShell; en otros sistemas se arranca a mano (sección 3) |

Internet solo hace falta la primera vez: para instalar dependencias, para que el navegador descargue el modelo de MediaPipe y para que el servicio de pose descargue sus modelos (~140 MB).

## 2. Arranque rápido (Windows)

Doble clic en `iniciar-demo.cmd` (o `.\iniciar-demo.ps1` en PowerShell). La primera vez instala dependencias y crea datos
ficticios; después arranca la API (3001), la web (5173) y el servicio de pose (8000), y abre el navegador. **Ctrl+C** detiene todo.

| Opción | Efecto |
|---|---|
| `-SinPose` | No arranca el servicio de pose; el análisis de video usa solo el navegador |
| `-Reiniciar` | Borra y recrea los datos de demostración (contraseña nueva) |
| `-NoAbrirNavegador` | No abre el navegador |

Las cuentas de demostración comparten una contraseña **generada al azar** que se muestra al arrancar y se guarda en
`apps/backend/data/demo-credentials.txt`. Fisioterapeuta y administradora: `camila.restrepo@ejemplo.co`; seis pacientes con
correos `@ejemplo.co`. Los registros de cada servicio quedan en `logs/`.

## 3. Arranque manual

```bash
cd apps/backend  && npm install && npm run seed -- --reset && POSE_SERVICE_URL=http://127.0.0.1:8000 npm start
cd apps/web      && npm install && npm run dev
cd apps/pose-service && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt && uvicorn app.main:app --port 8000
```

Con la base vacía (sin `seed`), la pantalla de ingreso pide crear la cuenta del **administrador**.

## 4. Variables de entorno (API)

| Variable | Efecto |
|---|---|
| `PORT` (3001), `DB_FILE` | Puerto y archivo de la base SQLite |
| `POSE_SERVICE_URL`, `POSE_API_KEY` | Dirección y clave del servicio de pose (si no está, el análisis en servidor responde 503 y la web lo deshabilita) |
| `SETUP_TOKEN` | Si se define, crear el primer administrador exige la cabecera `X-Setup-Token` |
| `COOKIE_SECURE=1` | La cookie de sesión solo viaja por HTTPS. **Obligatoria al publicar** |
| `ALLOWED_ORIGINS` | Orígenes adicionales permitidos para cambios de datos con cookie |

Servicio de pose: `POSE_MODE` (`lightweight`/`balanced`/`performance`), `POSE_DEVICE` (`cpu`/`cuda`), `POSE_API_KEY`, `POSE_MAX_VIDEO_MB`.

## 5. Uso por rol

**Paciente.** Ingresa con su correo y la contraseña temporal que le dio su fisioterapeuta (la cambia en el primer ingreso).
En «Inicio» ve su plan y su semana. «Ver cómo se hace y empezar» lleva al ejercicio con cámara; «Tengo un video grabado» permite
subir un video (elegir análisis en el navegador —privado— o con el servicio de IA, que pide consentimiento). Ubicación de la
cámara: de perfil o de frente según el ejercicio, cuerpo completo, buena luz, fondo despejado; cámara trasera del celular.

**Fisioterapeuta.** «Resumen» (alertas y prioridades), «Pacientes» (alta con contraseña inicial, ficha, plan, rutinas, notas,
sesiones con replay, informe imprimible), «Biblioteca», «Evidencia clínica» y «Configuración» (umbrales de alertas). Registra la
autorización de datos personales de cada paciente en la pestaña «Datos» y puede restablecer su contraseña.

**Administrador** (un fisioterapeuta con permiso extra). «Cuentas»: crear, desactivar y restablecer la contraseña de
fisioterapeutas. No ve la información clínica de pacientes ajenos.

## 6. Pruebas

```bash
cd apps/backend && npm test            # API, permisos, análisis, informe
cd apps/web && npm test                # lógica de la interfaz
cd apps/tracking-prototype && node --test tests/*.test.mjs   # motor de ángulos y repeticiones
cd apps/pose-service && pytest && node --test tests/validate.test.mjs
```

Revisión en tamaño de celular (con la demo corriendo): `cd apps/web && npm i --no-save playwright-core && node tools/mobile-check.mjs capturas 390 844`.

## 7. Copia de seguridad

Todo el estado vive en un archivo: `apps/backend/data/telerehab.db`. Para respaldar, **detén la API** y copia ese archivo. Contiene
datos de salud: guárdalo cifrado y con acceso restringido. Para empezar de cero, bórralo (se recrea con las migraciones).

## 8. Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| «No se pudo conectar con el servidor» | La API no está corriendo (revisa `logs/backend.err.log`) |
| «Servicio de IA avanzado… no disponible» | El servicio de pose no responde: reinicia con el lanzador o usa «En mi navegador» |
| La cámara no abre | El navegador la bloquea en `file://`; usa `http://localhost:5173`. Revisa el permiso de cámara |
| Cuenta bloqueada | 5 intentos fallidos bloquean 15 minutos; el administrador o el fisioterapeuta puede restablecer la contraseña |
| El servicio de pose tarda | En CPU, ~2 min por cada 30 s de video. Usa `POSE_MODE=lightweight` o una GPU |
| `Falta 'node'` / versión | Instala Node 22.5 o superior |
