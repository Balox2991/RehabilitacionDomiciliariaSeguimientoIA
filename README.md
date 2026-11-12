# Sistema de Telerehabilitación Asistido por IA (Recuperación de Fracturas)

Proyecto de grado — Ingeniería de Sistemas. Sistema de telerehabilitación
para pacientes en recuperación de fracturas, con dos módulos: paciente
(recuperación autónoma en casa) y fisioterapeuta (analítica y gestión
clínica).

## Estado del proyecto

Construcción por fases. Ver `docs/` para la documentación técnica de cada
fase (decisiones y su justificación, pensada para usarse en el documento de
sustentación).

- [x] **Fase 1 — Prototipo de tracking de movimiento** (`apps/tracking-prototype/`)
      Ver `docs/FASE-1-TRACKING.md`.
- [x] **Fase 2 — Backend + base de datos** (`apps/backend/`)
      Ver `docs/FASE-2-BACKEND.md`.
- [~] **Fase 3 — Plataforma del paciente** (`apps/web/`, en curso): hechos el plan, el
      progreso, el ejercicio con cámara, el análisis de la sesión y del video grabado, la
      biblioteca educativa y el asistente de recuperación; faltan cuerpo interactivo, videos
      reales de demostración y chatbot (propuesta: sustituirlo por el asistente explicable).
      Ver `docs/FASE-3-WEB.md`.
- [~] **Fase 4 — Dashboard del fisioterapeuta** (`apps/web/`, en curso): hechos los KPIs,
      alertas, ficha, prescripción de planes y rutinas, análisis por sesión y sugerencias del
      asistente; faltan los reportes redactados con IA.
- [~] **Fase 5 — Autenticación por rol** (hecha: cuentas, sesiones, roles, permisos en el servidor, bloqueo, auditoría,
      cambio de contraseña, administración de fisioterapeutas; faltan correo de invitación/recuperación, HTTPS y pulido de interfaz).
      Ver `docs/ARQUITECTURA.md` §5 y §6.
- [ ] Fase 6 — Documentación técnica final

Ver también `docs/CONSIDERACIONES-COLOMBIA.md` (ficha del paciente, normas colombianas y recomendaciones).

## Estructura

```
telerehab-ia/
├── apps/
│   ├── tracking-prototype/   Fase 1: prototipo aislado de tracking (HTML/JS + MediaPipe)
│   ├── backend/              Fase 2: API REST (Express) + SQLite
│   ├── pose-service/         Servicio de pose opcional (FastAPI + RTMPose) para analizar videos
│   └── web/                  Fases 3-4: app React (paciente + fisioterapeuta)
├── docs/                     Documentación técnica por fase
└── README.md
```

## Cómo levantarlo

```bash
cd apps/backend && npm install && npm run seed && npm start   # API :3001 (datos ficticios de demostración)
cd apps/web     && npm install && npm run dev                 # web :5173
```

Servicio de pose (opcional, ver `apps/pose-service/README.md`): `uvicorn app.main:app --port 8000` y backend con `POSE_SERVICE_URL=http://localhost:8000`.

**Primer ingreso:** con la base vacía, la pantalla de ingreso pide crear la cuenta del administrador. Con datos de demostración
(`npm run seed -- --reset`) todas las cuentas usan la contraseña que imprime el comando (fisioterapeuta y administradora:
`camila.restrepo@ejemplo.co`). Variables: `SETUP_TOKEN` (exige un token para crear el primer administrador), `COOKIE_SECURE=1`
(cookie solo por HTTPS; obligatoria al publicar), `ALLOWED_ORIGINS`.

Pruebas: `npm test` dentro de cada app (backend 112, web 99, tracking-prototype 138).
