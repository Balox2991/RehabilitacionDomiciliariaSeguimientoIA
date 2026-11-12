// Autenticación: contraseñas (scrypt), sesiones con token opaco revocable, bloqueo por intentos y auditoría.
// Solo usa node:crypto (sin dependencias). Ver docs/ARQUITECTURA.md §6.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export const SESSION_TTL_MS = 12 * 3600_000; // la sesión caduca a las 12 h sin renovarse
export const MAX_FAILED = 5;
export const LOCK_MS = 15 * 60_000;
export const COOKIE = "sid";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored ?? "").split("$");
  if (alg !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const got = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(got, expected);
}

// Hash de una contraseña inexistente: se verifica igual cuando el correo no existe, para que tardar lo mismo no delate qué correos tienen cuenta.
const DUMMY_HASH = hashPassword("contraseña-que-nadie-usa-0");
export const verifyDummy = (password) => verifyPassword(password, DUMMY_HASH);

/** Devuelve un mensaje de error o null si la contraseña es aceptable. */
export function passwordProblem(password, email = "") {
  if (typeof password !== "string") return "La contraseña es obligatoria.";
  if (password.length < 10) return "La contraseña debe tener al menos 10 caracteres.";
  if (password.length > 200) return "La contraseña es demasiado larga (máximo 200).";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "La contraseña debe mezclar letras y números.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return "La contraseña no debe contener tu correo.";
  return null;
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function createSession(db, userId, now, userAgent) {
  const token = newToken();
  const at = now.toISOString();
  db.prepare("INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)")
    .run(hashToken(token), userId, at, new Date(now.getTime() + SESSION_TTL_MS).toISOString(), at, (userAgent ?? "").slice(0, 200));
  return token;
}

/** Usuario dueño del token si la sesión es válida (existe, no caducó, cuenta activa). Renueva la caducidad al usarla. */
export function userForToken(db, token, now) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const row = db.prepare(
    `SELECT s.id AS sid, s.expires_at, u.id, u.role, u.name, u.email, u.is_admin, u.active, u.must_change_password
       FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`
  ).get(hashToken(token));
  if (!row) return null;
  if (row.expires_at <= now.toISOString() || !row.active) {
    db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(row.sid);
    return null;
  }
  db.prepare("UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?")
    .run(now.toISOString(), new Date(now.getTime() + SESSION_TTL_MS).toISOString(), row.sid);
  return { id: row.id, role: row.role, name: row.name, email: row.email, is_admin: Boolean(row.is_admin), must_change_password: Boolean(row.must_change_password), sid: row.sid };
}

export const revokeToken = (db, token) => db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(hashToken(token));
export const revokeUserSessions = (db, userId, exceptSid = 0) => db.prepare("DELETE FROM auth_sessions WHERE user_id = ? AND id <> ?").run(userId, exceptSid);

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookieHeader(token, { secure }) {
  const parts = [`${COOKIE}=${token}`, "HttpOnly", "SameSite=Strict", "Path=/", `Max-Age=${SESSION_TTL_MS / 1000}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
export const clearCookieHeader = ({ secure }) => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;

export function audit(db, now, { userId = null, action, target = null, status = null, ip = null }) {
  db.prepare("INSERT INTO audit_log (at, user_id, action, target, status, ip) VALUES (?, ?, ?, ?, ?, ?)").run(now.toISOString(), userId, action, target, status, ip);
}

/** Limitador en memoria por clave (ventana fija). Frena la fuerza bruta por IP; el bloqueo por cuenta vive en la base. */
export function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return (key, nowMs = Date.now()) => {
    const h = hits.get(key);
    if (!h || nowMs - h.start >= windowMs) {
      hits.set(key, { start: nowMs, n: 1 });
      if (hits.size > 5000) for (const [k, v] of hits) if (nowMs - v.start >= windowMs) hits.delete(k);
      return true;
    }
    h.n++;
    return h.n <= max;
  };
}
