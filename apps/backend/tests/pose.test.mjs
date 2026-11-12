import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import { createApp } from "../src/app.js";
import { createPoseClient } from "../src/poseClient.js";

// Servicio de pose simulado: una persona que dobla la rodilla 4 veces (cadera–rodilla–tobillo de 175° a 70°).
function fakeFrames({ people = true } = {}) {
  const frames = [];
  const reps = 4, perRep = 30;
  for (let i = 0; i <= reps * perRep; i++) {
    const phase = (Math.sin((i / perRep) * 2 * Math.PI - Math.PI / 2) + 1) / 2; // 0 (extendida) .. 1 (flexionada)
    const knee = (175 - phase * 105) * (Math.PI / 180);
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
    // perfil: cadera arriba, rodilla al frente, tobillo según el ángulo
    lm[23] = { x: 0.4, y: 0.4, z: 0, visibility: 0.99 }; lm[24] = lm[23];
    lm[25] = { x: 0.5, y: 0.6, z: 0, visibility: 0.99 }; lm[26] = lm[25];
    const hipV = { x: 0.4 - 0.5, y: 0.4 - 0.6 };
    const len = 0.2, base = Math.atan2(hipV.y, hipV.x);
    const a = base + knee; // gira el segmento rodilla->cadera por el ángulo de la rodilla
    lm[27] = { x: 0.5 + len * Math.cos(a), y: 0.6 + len * Math.sin(a), z: 0, visibility: 0.99 }; lm[28] = lm[27];
    frames.push({ t_ms: Math.round(i * 66), landmarks: people ? lm : null });
  }
  return frames;
}

function makeFetch({ frames, fail } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    if (fail) return new Response(JSON.stringify({ detail: fail.detail }), { status: fail.status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/health")) return Response.json({ ok: true, version: "t", loaded: [], default_mode: "balanced" });
    return Response.json({ model: "rtmpose-balanced", width: 640, height: 480, fps: 30, step_ms: 66, frames_total: frames.length, frames_with_person: frames.length, processing_ms: 5, frames });
  };
  fn.calls = calls;
  return fn;
}

let server, base;
async function boot(pose) {
  const db = openDb(":memory:");
  server = createApp(db, { auth: false, pose }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://localhost:${server.address().port}`;
}
const post = (qs, body = Buffer.from("fakevideo"), type = "video/mp4") =>
  fetch(`${base}/pose/analyze-video?${qs}`, { method: "POST", headers: { "content-type": type }, body });
after(() => server?.close());

test("sin POSE_SERVICE_URL: status dice que no está configurado y analizar responde 503", async () => {
  await boot(createPoseClient({ url: "" }));
  assert.deepEqual(await (await fetch(`${base}/pose/status`)).json(), { configured: false, available: false });
  const res = await post("exercise_code=knee_flexion&side=left");
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /POSE_SERVICE_URL/);
  server.close();
});

test("analiza un video: arma el registro y cuenta las repeticiones con el motor compartido", async () => {
  const fetchImpl = makeFetch({ frames: fakeFrames() });
  await boot(createPoseClient({ url: "http://pose:8000", apiKey: "k", fetchImpl }));
  const res = await post("exercise_code=knee_flexion&side=left&target_angle=90&mode=lightweight");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.model, "rtmpose-balanced");
  assert.equal(body.trace.format, "telerehab-trace/2");
  assert.equal(body.trace.meta.exercise, "knee_flexion");
  assert.equal(body.analysis.reps.length, 4);
  assert.ok(body.frames_with_person > 100);
  const sent = fetchImpl.calls.at(-1);
  assert.equal(sent.url, "http://pose:8000/pose/video");
  assert.equal(sent.init.headers["x-api-key"], "k");
  assert.equal(sent.init.body.get("mode"), "lightweight");
  server.close();
});

test("el registro devuelto se puede guardar como sesión (lo vuelve a validar y analizar)", async () => {
  await boot(createPoseClient({ url: "http://pose:8000", fetchImpl: makeFetch({ frames: fakeFrames() }) }));
  const j = (m, p, b) => fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const t = await j("POST", "/users", { role: "therapist", name: "Fisio", email: "f@x.co" });
  const p = await j("POST", "/users", { role: "patient", name: "Paciente", email: "p@x.co", therapist_id: t.body.id, fracture_site: "tibia" });
  assert.equal(p.status, 201, JSON.stringify(p.body));
  const analyzed = await (await post("exercise_code=knee_flexion&side=left&target_angle=90")).json();
  const saved = await j("POST", `/patients/${p.body.id}/sessions`, { exercise_code: "knee_flexion", side: "left", target_angle: 90, started_at: new Date().toISOString(), reps: [], trace: analyzed.trace });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  assert.equal(saved.body.reps_completed, 4);
  server.close();
});

test("validaciones y errores del servicio", async () => {
  await boot(createPoseClient({ url: "http://pose:8000", fetchImpl: makeFetch({ frames: fakeFrames({ people: false }) }) }));
  assert.equal((await post("exercise_code=nope&side=left")).status, 400);
  assert.equal((await post("exercise_code=knee_flexion&side=up")).status, 400);
  assert.equal((await post("exercise_code=knee_flexion&side=left&mode=turbo")).status, 400);
  assert.equal((await post("exercise_code=knee_flexion&side=left", Buffer.alloc(0))).status, 400);
  const nobody = await post("exercise_code=knee_flexion&side=left");
  assert.equal(nobody.status, 400);
  assert.match((await nobody.json()).error, /no se detectó/);
  server.close();

  await boot(createPoseClient({ url: "http://pose:8000", fetchImpl: makeFetch({ fail: { status: 422, detail: "el video dura más de 180 s" } }) }));
  const bad = await post("exercise_code=knee_flexion&side=left");
  assert.equal(bad.status, 422);
  assert.match((await bad.json()).error, /180 s/);
  server.close();

  await boot(createPoseClient({ url: "http://pose:8000", fetchImpl: makeFetch({ fail: { status: 503, detail: "modelo" } }) }));
  assert.equal((await post("exercise_code=knee_flexion&side=left")).status, 502);
  server.close();
});
