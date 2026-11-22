import test from "node:test";
import assert from "node:assert/strict";
import { EXERCISES } from "../src/angleMath.js";
import { assessReliability } from "../src/reliability.js";

// Registro sintético: persona grande, de perfil, rodilla que se dobla suavemente y esqueleto estable.
function makeTrace({ n = 120, vis = 0.95, jitter = 0, scaleFactor = 1, exercise = "knee_flexion" } = {}) {
  const t = [], angle = [], v = [], frames = [];
  for (let i = 0; i < n; i++) {
    t.push(i * 66);
    let a = 130 + 45 * Math.sin(i / 8);
    if (jitter && i % 5 === 0) a += jitter * (i % 10 === 0 ? 1 : -1);
    angle.push(a); v.push(vis);
  }
  // 12 puntos: hombros(0,1) codos(2,3) muñecas(4,5) caderas(6,7) rodillas(8,9) tobillos(10,11)
  const pose = [[.5, .2], [.5, .2], [.5, .35], [.5, .35], [.5, .5], [.5, .5], [.5, .5], [.5, .5], [.55, .7], [.55, .7], [.5, .9], [.5, .9]];
  for (let i = 0; i < n; i += 2) frames.push(pose.flatMap(([x, y]) => [Math.round(((x - .5) * scaleFactor + .5) * 1000), Math.round(((y - .5) * scaleFactor + .5) * 1000)]));
  return {
    meta: { exercise, side: "left", width: 640, height: 480, direction: "decreasing" },
    t, angle, vis: v,
    skeleton: { joints: ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"], stride: 2, frames },
  };
}

test("señal limpia, grande y visible: confiable", () => {
  const r = assessReliability(makeTrace(), EXERCISES.knee_flexion);
  assert.equal(r.verdict, "reliable");
  assert.deepEqual(r.failed, []);
});

test("articulación casi siempre oculta: no confiable y da consejo", () => {
  const r = assessReliability(makeTrace({ vis: 0.3 }), EXERCISES.knee_flexion);
  assert.equal(r.verdict, "unreliable");
  assert.ok(r.failed.includes("visiblePct"));
  assert.ok(r.advice.length > 0);
});

test("persona diminuta en la imagen: dudosa por el tamaño", () => {
  const r = assessReliability(makeTrace({ scaleFactor: 0.25 }), EXERCISES.knee_flexion);
  assert.ok(r.failed.includes("scale"));
  assert.equal(r.verdict, "uncertain");
});

test("saltos imposibles del ángulo: se detectan", () => {
  const r = assessReliability(makeTrace({ jitter: 80 }), EXERCISES.knee_flexion);
  assert.ok(r.failed.includes("jumpPct"));
});

test("registro vacío: no confiable, sin romper", () => {
  const r = assessReliability({ meta: { exercise: "knee_flexion", side: "left", width: 640, height: 480 }, t: [], angle: [], vis: [] }, EXERCISES.knee_flexion);
  assert.equal(r.verdict, "unreliable");
});

import { assessRecent, windowTrace } from "../src/reliability.js";

test("assessRecent: con menos de 2,5 s de datos todavía no juzga", () => {
  assert.equal(assessRecent(makeTrace({ n: 20 }), EXERCISES.knee_flexion), null);
});

test("assessRecent: juzga solo los últimos segundos (una mala racha reciente se nota aunque el inicio fuera bueno)", () => {
  const trace = makeTrace({ n: 300 });
  for (let i = 270; i < 300; i++) trace.vis[i] = 0.2; // los últimos ~2 s se perdió la articulación (90 % de toda la sesión sí se vio)
  assert.equal(assessRecent(trace, EXERCISES.knee_flexion).verdict, "unreliable");
  assert.equal(assessReliability(trace, EXERCISES.knee_flexion).verdict, "reliable", "el promedio de toda la sesión no lo notaría");
});

test("windowTrace recorta tiempos, ángulos, visibilidad y esqueleto a la vez", () => {
  const w = windowTrace(makeTrace({ n: 100 }), 1000);
  assert.equal(w.t.length, w.angle.length);
  assert.equal(w.t.length, w.vis.length);
  assert.ok(w.skeleton.frames.length <= Math.ceil(w.t.length / 2) + 1);
});

test("sin esqueleto guardado: no se juzga el tamaño ni la deformación, pero sí la visibilidad", () => {
  const trace = makeTrace(); delete trace.skeleton;
  assert.equal(assessReliability(trace, EXERCISES.knee_flexion).verdict, "reliable");
});
