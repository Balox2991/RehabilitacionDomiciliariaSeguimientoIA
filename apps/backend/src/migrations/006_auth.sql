-- Migración 6 — cuentas reales (Fase 5): contraseñas, sesiones revocables, bloqueo por intentos y auditoría.
-- Ver docs/ARQUITECTURA.md §6. La contraseña NUNCA se guarda: solo su hash scrypt con sal propia.

ALTER TABLE users ADD COLUMN password_hash TEXT;                                  -- NULL = la cuenta aún no puede ingresar
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)); -- solo fisioterapeutas
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));
ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1));
ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;                                   -- ISO UTC

-- El token que recibe el cliente es aleatorio y opaco; aquí solo se guarda su hash SHA-256 (si se filtra la base, los
-- tokens no sirven). Borrar la fila = cerrar esa sesión al instante.
CREATE TABLE auth_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash    TEXT NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  user_agent    TEXT
);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);

-- Quién hizo qué y cuándo sobre datos de pacientes y cuentas (Ley 1581 de 2012).
CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target       TEXT,
  status       INTEGER,
  ip           TEXT
);
CREATE INDEX idx_audit_user ON audit_log(user_id, at);
