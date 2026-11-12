import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { hashPassword, verifyPassword, passwordProblem, createLimiter } from "../src/auth.js";

let server, base, db, clock;
const NOW0 = new Date("2026-11-01T12:00:00Z");
const PW = "Clave-Segura-123";
const PWP = "Paciente-Clave-77"; // la que eligen los pacientes al cambiar la inicial

before(async () => {
  clock = NOW0.getTime();
  db = openDb(":memory:");
  server = createApp(db, { now: () => new Date(clock), loginsPerWindow: 1000 }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

// Cliente mínimo con su propia "cookie jar" (una sesión por cliente).
function client() {
  let cookie = "";
  const c = {
    async call(method, path, body, headers = {}) {
      const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers, setCookie: set };
    },
    login: (email, password = PW) => c.call("POST", "/auth/login", { email, password }),
  };
  return c;
}

test("contraseñas: scrypt con sal, verifica y rechaza; reglas mínimas", () => {
  const a = hashPassword(PW), b = hashPassword(PW);
  assert.notEqual(a, b); // sal distinta
  assert.match(a, /^scrypt\$/);
  assert.ok(verifyPassword(PW, a));
  assert.ok(!verifyPassword("otra-clave-123", a));
  assert.ok(!verifyPassword(PW, "basura"));
  assert.ok(passwordProblem("corta1"));
  assert.ok(passwordProblem("sololetrasaaaaaa"));
  assert.ok(passwordProblem("1234567890123"));
  assert.ok(passwordProblem("juanperez-2026-x", "juanperez@x.co")); // contiene el correo
  assert.equal(passwordProblem(PW, "a@b.co"), null);
});

test("limitador por ventana", () => {
  const lim = createLimiter({ max: 2, windowMs: 1000 });
  assert.ok(lim("k", 0) && lim("k", 1) && !lim("k", 2) && lim("k", 1500));
});

test("sin cuentas: setup-status lo dice y el resto de la API exige sesión", async () => {
  const c = client();
  assert.deepEqual((await c.call("GET", "/auth/setup-status")).body, { needs_setup: true });
  assert.equal((await c.call("GET", "/health")).status, 200);
  assert.equal((await c.call("GET", "/exercises")).status, 401);
});

let admin, fisio, fisio2, pac, pac2;

test("setup crea al administrador una sola vez y valida la contraseña", async () => {
  const c = client();
  assert.equal((await c.call("POST", "/auth/setup", { name: "Admin", email: "admin@x.co", password: "corta" })).status, 400);
  const ok = await c.call("POST", "/auth/setup", { name: "Admin", email: "Admin@X.co", password: PW });
  assert.equal(ok.status, 201);
  assert.equal((await c.call("POST", "/auth/setup", { name: "Otro", email: "otro@x.co", password: PW })).status, 409);
  assert.deepEqual((await c.call("GET", "/auth/setup-status")).body, { needs_setup: false });
  admin = client();
  const login = await admin.login("admin@x.co");
  assert.equal(login.status, 200);
  assert.equal(login.body.user.is_admin, true);
});

test("la cookie de sesión es HttpOnly + SameSite=Strict y el token no viaja en el cuerpo", async () => {
  const c = client();
  const r = await c.login("admin@x.co");
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Strict/);
  assert.equal(r.body.token, undefined);
  const mobile = await fetch(base + "/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-client": "mobile" }, body: JSON.stringify({ email: "admin@x.co", password: PW }) });
  const { token } = await mobile.json();
  assert.ok(token);
  const me = await fetch(base + "/auth/me", { headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
});

test("el administrador crea fisioterapeutas; estos crean pacientes suyos con contraseña inicial", async () => {
  assert.equal((await admin.call("POST", "/admin/therapists", { name: "Fisio Uno", email: "f1@x.co", password: PW })).status, 201);
  assert.equal((await admin.call("POST", "/admin/therapists", { name: "Fisio Dos", email: "f2@x.co", password: PW })).status, 201);
  fisio = client(); fisio2 = client();
  const l = await fisio.login("f1@x.co");
  assert.equal(l.body.user.must_change_password, true);
  assert.equal((await fisio.call("GET", "/exercises")).status, 403); // debe cambiar la contraseña primero
  assert.equal((await fisio.call("POST", "/auth/password", { current: PW, password: "Nueva-Clave-456" })).status, 200);
  assert.equal((await fisio.call("GET", "/exercises")).status, 200);
  await fisio2.login("f2@x.co");
  await fisio2.call("POST", "/auth/password", { current: PW, password: "Nueva-Clave-456" });

  const created = await fisio.call("POST", "/users", { role: "patient", name: "Pac Uno", email: "p1@x.co", therapist_id: 999, password: PW });
  assert.equal(created.status, 201);
  assert.equal(created.body.password_hash, undefined);
  const id1 = created.body.id;
  const p2 = await fisio2.call("POST", "/users", { role: "patient", name: "Pac Dos", email: "p2@x.co", password: PW });
  assert.equal(p2.status, 201);
  pac = { id: id1, c: client() }; pac2 = { id: p2.body.id, c: client() };
  for (const [cl, email] of [[pac.c, "p1@x.co"], [pac2.c, "p2@x.co"]]) {
    const l = await cl.login(email);
    assert.equal(l.status, 200);
    assert.equal(l.body.user.must_change_password, true); // con contraseña inicial: debe cambiarla antes de usar la API
    assert.equal((await cl.call("GET", "/exercises")).status, 403);
    assert.equal((await cl.call("POST", "/auth/password", { current: PW, password: PWP })).status, 200);
  }
  // therapist_id del cuerpo se ignora: el paciente quedó con SU fisioterapeuta (no con el 999)
  assert.equal((await fisio.call("GET", `/patients/${id1}`)).status, 200);
});

test("un fisioterapeuta no puede crear fisioterapeutas ni entrar a /admin", async () => {
  assert.equal((await fisio.call("POST", "/users", { role: "therapist", name: "X", email: "x@x.co" })).status, 403);
  assert.equal((await fisio.call("GET", "/admin/therapists")).status, 403);
  assert.equal((await fisio.call("GET", "/therapists")).status, 403);
  assert.equal((await pac.c.call("GET", "/admin/therapists")).status, 403);
});

test("aislamiento: cada fisioterapeuta solo ve a sus pacientes; el paciente solo lo suyo", async () => {
  const mine = `/patients/${pac.id}`, theirs = `/patients/${pac2.id}`;
  for (const suffix of ["", "/plans", "/sessions", "/notes", "/report", "/coach", "/overview", "/rom-history?exercise=knee_flexion"]) {
    assert.notEqual((await fisio.call("GET", mine + suffix)).status, 404, `fisio propio ${suffix}`);
    assert.equal((await fisio.call("GET", theirs + suffix)).status, 404, `fisio ajeno ${suffix}`);
    assert.equal((await pac.c.call("GET", theirs + suffix)).status, 404, `paciente ajeno ${suffix}`);
  }
  assert.equal((await admin.call("GET", mine)).status, 404); // el administrador no ve la clínica ajena
  assert.equal((await fisio.call("GET", "/therapists/1/summary")).status, 404); // resumen de otro fisio
  assert.equal((await fisio2.call("PATCH", mine, { notes: "x" })).status, 404);
  assert.equal((await fisio2.call("POST", `${mine}/notes`, { body: "hola" })).status, 404);
});

test("el paciente puede leer lo suyo y guardar sesiones, pero no editar ficha, planes, notas ni consentimiento", async () => {
  const mine = `/patients/${pac.id}`;
  assert.equal((await pac.c.call("GET", mine)).status, 200);
  assert.equal((await pac.c.call("GET", `${mine}/overview`)).status, 200);
  assert.equal((await pac.c.call("GET", `${mine}/notes`)).status, 403);
  assert.equal((await pac.c.call("PATCH", mine, { notes: "x" })).status, 403);
  assert.equal((await pac.c.call("PUT", `${mine}/consent`, { granted: true })).status, 403);
  assert.equal((await pac.c.call("POST", `${mine}/plans`, { exercise_code: "knee_flexion", side: "left" })).status, 403);
  assert.equal((await pac.c.call("POST", `${mine}/password`, { password: "Otra-Clave-789" })).status, 403);
  assert.equal((await pac.c.call("PATCH", "/library/x", { video_url: null })).status, 403);
  const plan = await fisio.call("POST", `${mine}/plans`, { exercise_code: "knee_flexion", side: "left", target_angle: 90, created_by: 12345 });
  assert.equal(plan.status, 201);
  assert.equal(plan.body.created_by, (await fisio.call("GET", "/auth/me")).body.user.id); // created_by sale de la sesión
  assert.equal((await pac.c.call("PATCH", `/plans/${plan.body.id}`, { sets: 9 })).status, 403);
  assert.equal((await fisio2.call("PATCH", `/plans/${plan.body.id}`, { sets: 9 })).status, 404);
  const body = { exercise_code: "knee_flexion", side: "left", target_angle: 90, started_at: new Date(clock).toISOString(), reps: [] };
  const ses = await pac.c.call("POST", `${mine}/sessions`, body);
  assert.equal(ses.status, 201);
  assert.equal((await pac.c.call("GET", `/sessions/${ses.body.id}`)).status, 200);
  assert.equal((await pac2.c.call("GET", `/sessions/${ses.body.id}`)).status, 404);
  assert.equal((await pac2.c.call("POST", `${mine}/sessions`, body)).status, 404);
  assert.equal((await pac.c.call("POST", `/sessions/${ses.body.id}/analysis`)).status, 403);
});

test("un fisioterapeuta no puede traspasar un paciente a otro fisioterapeuta", async () => {
  const f2id = (await fisio2.call("GET", "/auth/me")).body.user.id;
  assert.equal((await fisio.call("PATCH", `/patients/${pac.id}`, { therapist_id: f2id })).status, 403);
  assert.equal((await admin.call("PATCH", `/patients/${pac.id}`, { therapist_id: f2id })).status, 404); // el admin sin ser su fisio: tampoco
});

test("login: mensaje genérico, bloqueo tras 5 fallos, desbloqueo con el tiempo", async () => {
  const c = client();
  const unknown = await c.login("nadie@x.co", "cualquiera-123");
  const wrong = await c.login("p2@x.co", "mala-clave-123");
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.body.error, wrong.body.error); // no delata qué correos existen
  for (let i = 0; i < 3; i++) await c.login("p2@x.co", "mala-clave-123");
  const fifth = await c.login("p2@x.co", "mala-clave-123");
  assert.equal(fifth.status, 401);
  const locked = await c.login("p2@x.co", PWP); // aunque ahora acierte
  assert.equal(locked.status, 429);
  clock += 16 * 60_000;
  assert.equal((await c.login("p2@x.co", PWP)).status, 200);
});

test("logout revoca la sesión en el servidor; cambiar la contraseña cierra las demás sesiones", async () => {
  const a = client(), b = client();
  await a.login("p1@x.co", PWP); await b.login("p1@x.co", PWP);
  assert.equal((await a.call("POST", "/auth/logout")).status, 200);
  assert.equal((await a.call("GET", "/auth/me")).status, 401);
  assert.equal((await b.call("GET", "/auth/me")).status, 200);
  const c = client();
  await c.login("p1@x.co", PWP);
  assert.equal((await b.call("POST", "/auth/password", { current: "no-es-la-actual-1", password: "Otra-Clave-789" })).status, 401);
  assert.equal((await b.call("POST", "/auth/password", { current: PWP, password: "Otra-Clave-789" })).status, 200);
  assert.equal((await c.call("GET", "/auth/me")).status, 401); // la otra sesión murió
  assert.equal((await b.call("GET", "/auth/me")).status, 200);
});

test("cuenta desactivada: no entra y pierde sesiones; el admin no puede desactivarse ni tocar pacientes", async () => {
  const f2 = client();
  await f2.login("f2@x.co", "Nueva-Clave-456");
  const f2id = (await f2.call("GET", "/auth/me")).body.user.id;
  assert.equal((await admin.call("PATCH", `/admin/users/${f2id}`, { active: false })).status, 200);
  assert.equal((await f2.call("GET", "/auth/me")).status, 401);
  assert.equal((await client().login("f2@x.co", "Nueva-Clave-456")).status, 401);
  const adminId = (await admin.call("GET", "/auth/me")).body.user.id;
  assert.equal((await admin.call("PATCH", `/admin/users/${adminId}`, { active: false })).status, 400);
  assert.equal((await admin.call("PATCH", `/admin/users/${pac.id}`, { active: false })).status, 404);
  assert.equal((await admin.call("POST", `/admin/users/${pac.id}/password`, { password: "Nueva-Clave-999" })).status, 404);
  assert.equal((await admin.call("PATCH", `/admin/users/${f2id}`, { active: true })).status, 200);
  assert.equal((await fisio2.login("f2@x.co", "Nueva-Clave-456")).status, 200); // vuelve a entrar (sus sesiones se habían cerrado)
});

test("el fisioterapeuta define la contraseña de SU paciente (queda obligado a cambiarla)", async () => {
  assert.equal((await fisio.call("POST", `/patients/${pac.id}/password`, { password: "Temporal-Clave-1" })).status, 200);
  const c = client();
  const l = await c.login("p1@x.co", "Temporal-Clave-1");
  assert.equal(l.body.user.must_change_password, true);
  assert.equal((await c.call("GET", `/patients/${pac.id}`)).status, 403);
  assert.equal((await fisio2.call("POST", `/patients/${pac.id}/password`, { password: "Temporal-Clave-1" })).status, 404);
});

test("CSRF: con cookie, un cambio de datos desde otro origen se rechaza", async () => {
  const c = client();
  await c.login("p1@x.co", "Temporal-Clave-1");
  await c.call("POST", "/auth/password", { current: "Temporal-Clave-1", password: "Definitiva-Clave-2" });
  const bad = await c.call("POST", "/auth/logout", undefined, { origin: "https://sitio-malo.example" });
  assert.equal(bad.status, 403);
  assert.equal((await c.call("GET", "/auth/me")).status, 200);
});

test("auditoría: queda registro de accesos y cambios sobre pacientes", () => {
  const rows = db.prepare("SELECT action, status FROM audit_log").all();
  assert.ok(rows.some((r) => r.action === "auth.login"));
  assert.ok(rows.some((r) => r.action === "auth.login.fail"));
  assert.ok(rows.some((r) => r.action.startsWith("POST /patients/") && r.action.endsWith("/sessions") && r.status === 201));
  assert.ok(rows.some((r) => r.action.startsWith("GET /patients/") && r.status === 404)); // los intentos denegados también
});

test("la sesión caduca a las 12 h y se renueva con el uso", async () => {
  const c = client();
  await c.login("p2@x.co", PWP);
  clock += 11 * 3600_000;
  assert.equal((await c.call("GET", "/auth/me")).status, 200); // renueva
  clock += 11 * 3600_000;
  assert.equal((await c.call("GET", "/auth/me")).status, 200);
  clock += 13 * 3600_000;
  assert.equal((await c.call("GET", "/auth/me")).status, 401);
});

test("ninguna ruta de la API responde sin sesión (salvo las públicas)", async () => {
  const router = server._events.request.router ?? server._events.request._router;
  const routes = [];
  for (const layer of router.stack) if (layer.route) for (const m of Object.keys(layer.route.methods)) routes.push([m.toUpperCase(), layer.route.path]);
  assert.ok(routes.length > 40, `se esperaban muchas rutas, hay ${routes.length}`);
  const open = new Set(["GET /health", "GET /auth/setup-status", "POST /auth/setup", "POST /auth/login"]);
  for (const [method, path] of routes) {
    if (open.has(`${method} ${path}`)) continue;
    const res = await fetch(base + path.replace(/:\w+/g, "1"), { method, headers: { "content-type": "application/json" }, body: ["GET", "HEAD"].includes(method) ? undefined : "{}" });
    assert.equal(res.status, 401, `${method} ${path} respondió ${res.status} sin sesión`);
  }
});

test("límite de inicios de sesión por conexión: responde 429", async () => {
  const db2 = openDb(":memory:");
  const s2 = createApp(db2, { loginsPerWindow: 3 }).listen(0);
  await new Promise((r) => s2.once("listening", r));
  const url = `http://localhost:${s2.address().port}/auth/login`;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@b.co", password: "x-y-z-123456" }) })).status);
  s2.close();
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
});
