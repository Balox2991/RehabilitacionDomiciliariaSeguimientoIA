// Rutas de cuentas y el guardia que protege el resto de la API. Se registra ANTES de las demás rutas.
import {
  COOKIE, LOCK_MS, MAX_FAILED, audit, clearCookieHeader, cookieHeader, createLimiter, createSession, hashPassword, parseCookies,
  passwordProblem, revokeToken, revokeUserSessions, userForToken, verifyDummy, verifyPassword,
} from "./auth.js";
import { auditable, authorize, isPublic } from "./policy.js";

const EMAIL = /^\S+@\S+\.\S+$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, is_admin: Boolean(u.is_admin), must_change_password: Boolean(u.must_change_password) });

export function registerAuth(app, { db, now, enforce, HttpError, require_, secure, allowedOrigins = [], loginsPerWindow = 20 }) {
  const loginLimiter = createLimiter({ max: loginsPerWindow, windowMs: 15 * 60_000 });
  const ipOf = (req) => req.ip ?? req.socket?.remoteAddress ?? null;
  const tokenOf = (req) => {
    const h = req.get("authorization");
    if (h?.startsWith("Bearer ")) return { token: h.slice(7).trim(), via: "bearer" };
    const c = parseCookies(req.get("cookie"))[COOKIE];
    return c ? { token: c, via: "cookie" } : { token: null, via: null };
  };

  // Cabeceras de seguridad básicas + nada de datos de la API en caché compartida.
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" });
    next();
  });

  // ---- Públicas ---------------------------------------------------------------
  const hasCredentials = () => db.prepare("SELECT COUNT(*) AS n FROM users WHERE password_hash IS NOT NULL").get().n > 0;

  app.get("/auth/setup-status", (_req, res) => res.json({ needs_setup: !hasCredentials() }));

  // Primera cuenta (administrador). Solo funciona mientras no exista ninguna cuenta con contraseña.
  app.post("/auth/setup", (req, res) => {
    if (process.env.SETUP_TOKEN && req.get("x-setup-token") !== process.env.SETUP_TOKEN) throw new HttpError(403, "token de configuración inválido");
    if (hasCredentials()) throw new HttpError(409, "el sistema ya está configurado");
    const { name, email, password } = req.body ?? {};
    require_(typeof name === "string" && name.trim(), "name es obligatorio");
    require_(typeof email === "string" && EMAIL.test(email), "email inválido");
    const problem = passwordProblem(password, email);
    require_(!problem, problem);
    try {
      const id = Number(db.prepare("INSERT INTO users (role, name, email, password_hash, is_admin) VALUES ('therapist', ?, ?, ?, 1)").run(name.trim(), email.toLowerCase(), hashPassword(password)).lastInsertRowid);
      audit(db, now(), { userId: id, action: "auth.setup", ip: ipOf(req), status: 201 });
      res.status(201).json({ id });
    } catch (err) {
      if (/UNIQUE/.test(err.message)) throw new HttpError(409, "ya existe un usuario con ese email");
      throw err;
    }
  });

  app.post("/auth/login", (req, res) => {
    const ip = ipOf(req);
    if (!loginLimiter(ip ?? "?", now().getTime())) throw new HttpError(429, "Demasiados intentos desde esta conexión. Espera unos minutos.");
    const { email, password } = req.body ?? {};
    require_(typeof email === "string" && typeof password === "string" && password.length <= 200, "email y password son obligatorios");
    const generic = new HttpError(401, "Correo o contraseña incorrectos.");
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
    if (!user || !user.password_hash || !user.active) {
      verifyDummy(password);
      audit(db, now(), { userId: user?.id ?? null, action: "auth.login.fail", target: user ? "cuenta sin acceso" : null, ip, status: 401 });
      throw generic;
    }
    if (user.locked_until && user.locked_until > now().toISOString()) {
      audit(db, now(), { userId: user.id, action: "auth.login.locked", ip, status: 429 });
      throw new HttpError(429, "Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en unos minutos.");
    }
    if (!verifyPassword(password, user.password_hash)) {
      const failed = user.failed_logins + 1;
      const lock = failed >= MAX_FAILED ? new Date(now().getTime() + LOCK_MS).toISOString() : null;
      db.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").run(lock ? 0 : failed, lock, user.id);
      audit(db, now(), { userId: user.id, action: "auth.login.fail", ip, status: 401 });
      throw generic;
    }
    db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(user.id);
    const token = createSession(db, user.id, now(), req.get("user-agent"));
    audit(db, now(), { userId: user.id, action: "auth.login", ip, status: 200 });
    res.set("Set-Cookie", cookieHeader(token, { secure }));
    // El token solo viaja en el cuerpo para clientes que no usan cookies (app móvil); la web lo recibe únicamente en la cookie HttpOnly.
    res.json({ user: publicUser(user), ...(req.get("x-client") === "mobile" ? { token } : {}) });
  });

  // ---- Guardia: todo lo demás exige sesión válida y pasa por la política ---------
  app.use((req, res, next) => {
    if (!enforce) return next();
    if (isPublic(req.method, req.path)) return next();
    const { token, via } = tokenOf(req);
    const user = token ? userForToken(db, token, now()) : null;
    if (!user) return res.status(401).json({ error: "inicia sesión para continuar" });
    // Cookie + cambio de datos: el origen debe ser este mismo sitio (defensa extra sobre SameSite=Strict).
    if (via === "cookie" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host") && !allowedOrigins.includes(origin)) return res.status(403).json({ error: "origen no permitido" });
    }
    const denied = authorize(db, user, req.method, req.path, req.body);
    const log = auditable(req.method, req.path);
    if (log) res.on("finish", () => audit(db, now(), { userId: user.id, action: `${req.method} ${req.path}`, status: res.statusCode, ip: ipOf(req) }));
    if (denied) return res.status(denied.status).json({ error: denied.error, ...(denied.code ? { code: denied.code } : {}) });
    req.user = user;
    req.token = token;
    next();
  });

  // ---- Con sesión ---------------------------------------------------------------
  app.get("/auth/me", (req, res) => {
    const u = db.prepare("SELECT id, name, email, role, is_admin, must_change_password FROM users WHERE id = ?").get(req.user.id);
    res.json({ user: publicUser(u) });
  });

  app.post("/auth/logout", (req, res) => {
    revokeToken(db, req.token);
    res.set("Set-Cookie", clearCookieHeader({ secure }));
    res.json({ ok: true });
  });

  app.post("/auth/password", (req, res) => {
    const { current, password } = req.body ?? {};
    const row = db.prepare("SELECT email, password_hash FROM users WHERE id = ?").get(req.user.id);
    if (typeof current !== "string" || !verifyPassword(current, row.password_hash)) throw new HttpError(401, "La contraseña actual no es correcta.");
    const problem = passwordProblem(password, row.email);
    require_(!problem, problem);
    require_(password !== current, "La contraseña nueva debe ser distinta de la actual.");
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(password), req.user.id);
    revokeUserSessions(db, req.user.id, req.user.sid); // cierra las demás sesiones (por si alguien más tenía acceso)
    res.json({ ok: true });
  });

  // ---- Administración de cuentas -------------------------------------------------
  app.get("/admin/therapists", (_req, res) => {
    res.json(db.prepare(
      `SELECT u.id, u.name, u.email, u.is_admin, u.active, u.created_at,
              (SELECT COUNT(*) FROM patient_profiles p WHERE p.therapist_id = u.id) AS patients
         FROM users u WHERE u.role = 'therapist' ORDER BY u.name`
    ).all());
  });

  app.post("/admin/therapists", (req, res) => {
    const { name, email, password } = req.body ?? {};
    require_(typeof name === "string" && name.trim(), "name es obligatorio");
    require_(typeof email === "string" && EMAIL.test(email), "email inválido");
    const problem = passwordProblem(password, email);
    require_(!problem, problem);
    try {
      const id = Number(db.prepare("INSERT INTO users (role, name, email, password_hash, must_change_password) VALUES ('therapist', ?, ?, ?, 1)").run(name.trim(), email.toLowerCase(), hashPassword(password)).lastInsertRowid);
      res.status(201).json({ id, name: name.trim(), email: email.toLowerCase() });
    } catch (err) {
      if (/UNIQUE/.test(err.message)) throw new HttpError(409, "ya existe un usuario con ese email");
      throw err;
    }
  });

  // `onlyTherapists`: el administrador gestiona cuentas de fisioterapeutas; NO puede tocar las de pacientes (si les cambiara la
  // contraseña podría entrar como ellos y ver su clínica, lo que la política le niega).
  const accountOr404 = (raw, onlyTherapists = false) => {
    const id = Number(raw);
    const u = Number.isInteger(id) && id > 0 ? db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) : null;
    if (!u || (onlyTherapists && u.role !== "therapist")) throw new HttpError(404, "usuario no encontrado");
    return u;
  };

  app.patch("/admin/users/:id", (req, res) => {
    const u = accountOr404(req.params.id, true);
    const { active } = req.body ?? {};
    require_(typeof active === "boolean", "active debe ser true o false");
    require_(u.id !== req.user.id || active, "No puedes desactivar tu propia cuenta.");
    db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, u.id);
    if (!active) revokeUserSessions(db, u.id);
    res.json({ id: u.id, active });
  });

  app.post("/admin/users/:id/password", (req, res) => resetPassword(req, res, accountOr404(req.params.id, true)));
  // El fisioterapeuta define la contraseña inicial de SU paciente (la política ya comprobó que es suyo).
  app.post("/patients/:id/password", (req, res) => resetPassword(req, res, accountOr404(req.params.id)));

  function resetPassword(req, res, target) {
    const { password } = req.body ?? {};
    const email = db.prepare("SELECT email FROM users WHERE id = ?").get(target.id).email;
    const problem = passwordProblem(password, email);
    require_(!problem, problem);
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL WHERE id = ?").run(hashPassword(password), target.id);
    revokeUserSessions(db, target.id);
    res.json({ ok: true });
  }
}
