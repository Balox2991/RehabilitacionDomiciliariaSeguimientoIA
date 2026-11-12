import { test } from "node:test";
import assert from "node:assert/strict";
import { reportNarrative } from "../src/narrative.js";

const base = () => ({
  patient: { name: "Ana Prueba", fracture_site: "Tibia derecha", days_since_injury: 70 },
  summary: { sessions: 20, reps: 200, adherence_8w_pct: 85, compensation_rate_30d_pct: 10 },
  plans: [{ exercise_name: "Flexión de rodilla", side: "right", sessions: 20, baseline_flexion: 40, latest_flexion: 80, change_flexion: 40, target_flexion: 90, progress_pct: 80 }],
});
const text = (r) => reportNarrative(r).join(" ");

test("una mejora clara se describe con sus números y sin exagerar", () => {
  const t = text(base());
  assert.match(t, /de 40° en la primera sesión a 80° en la última/);
  assert.match(t, /mejora de 40°/);
  assert.match(t, /meta es 90° \(80 % de avance\)/);
  assert.match(t, /adherencia.*alta \(85 %/);
  assert.doesNotMatch(t, /alertas de postura/); // 10 % no llega al umbral
});

test("un cambio dentro del ruido de la cámara NO se presenta como mejora ni retroceso", () => {
  const r = base();
  r.plans[0].latest_flexion = 43; r.plans[0].change_flexion = 3;
  const t = text(r);
  assert.match(t, /dentro del margen de error/);
  assert.doesNotMatch(t, /mejora de/);
  assert.doesNotMatch(t, /disminución/);
});

test("un retroceso real se avisa y la adherencia baja sugiere preguntar al paciente", () => {
  const r = base();
  r.plans[0].latest_flexion = 30; r.plans[0].change_flexion = -10;
  r.summary.adherence_8w_pct = 30; r.summary.compensation_rate_30d_pct = 45;
  const t = text(r);
  assert.match(t, /disminución de 10°/);
  assert.match(t, /adherencia.*baja/);
  assert.match(t, /qué le dificulta/);
  assert.match(t, /45 % de las repeticiones tuvo alertas/);
});

test("sin sesiones o sin datos no inventa cifras, y siempre cierra con el aviso", () => {
  const r = base();
  r.summary = { sessions: 0, reps: 0, adherence_8w_pct: null, compensation_rate_30d_pct: null };
  r.plans = [{ exercise_name: "Flexión de rodilla", side: "left", sessions: 0, baseline_flexion: null, latest_flexion: null, change_flexion: null, target_flexion: 90, progress_pct: null }];
  const out = reportNarrative(r);
  assert.match(out.join(" "), /todavía no hay sesiones registradas/);
  assert.doesNotMatch(out.join(" "), /adherencia/);
  assert.match(out.at(-1), /No es un diagnóstico/);
});
