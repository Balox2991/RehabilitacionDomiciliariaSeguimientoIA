import { test } from "node:test";
import assert from "node:assert/strict";
import { blandAltman, icc21, wilcoxon, errorSummary, clusterBootstrap } from "../tools/stats.mjs";
import { analyze, parseCsv, report } from "../tools/validate.mjs";

// Generador determinista (mulberry32) y normal (Box-Muller) para simular una validación con verdad conocida.
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const normal = (r, s) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()) * s;

test("Bland-Altman recupera el sesgo y la dispersión inyectados", () => {
  const r = rng(1);
  const truth = Array.from({ length: 2000 }, () => 20 + r() * 110);
  const cam = truth.map((t) => t + 4 + normal(r, 3));
  const ba = blandAltman(cam, truth);
  assert.ok(Math.abs(ba.bias - 4) < 0.25, `sesgo ${ba.bias}`);
  assert.ok(Math.abs(ba.sd - 3) < 0.25, `sd ${ba.sd}`);
  assert.ok(ba.loa[0] < ba.bias && ba.bias < ba.loa[1]);
  assert.ok(Math.abs(ba.proportionalSlope) < 0.02);
  const prop = blandAltman(truth.map((t) => t * 1.1), truth); // error proporcional: la pendiente lo delata
  assert.ok(Math.abs(prop.proportionalSlope - 0.1) < 0.005);
});

test("ICC(2,1): 1 con acuerdo perfecto, baja con ruido, penaliza el sesgo (acuerdo absoluto)", () => {
  const r = rng(2);
  const truth = Array.from({ length: 300 }, () => 20 + r() * 110);
  assert.ok(Math.abs(icc21(truth, truth) - 1) < 1e-9);
  const noisy = icc21(truth, truth.map((t) => t + normal(r, 5)));
  assert.ok(noisy > 0.97 && noisy < 1);
  const noisier = icc21(truth, truth.map((t) => t + normal(r, 40)));
  assert.ok(noisier < noisy);
  assert.ok(icc21(truth, truth.map((t) => t + 30)) < 0.95); // un desfase constante grande resta acuerdo absoluto
});

test("errores: MAE, RMSE y porcentajes dentro de ±5° y ±10°", () => {
  const e = errorSummary([0, 0, 0, 0], [1, 6, 11, 0]);
  assert.equal(e.mae, 4.5);
  assert.equal(e.within5, 0.5);
  assert.equal(e.within10, 0.75);
});

test("Wilcoxon: detecta un modelo claramente mejor y no inventa diferencias entre iguales", () => {
  const r = rng(3);
  const a = Array.from({ length: 60 }, () => Math.abs(normal(r, 3)));
  const b = a.map((v) => v + 2 + Math.abs(normal(r, 1)));
  assert.ok(wilcoxon(a, b).p < 0.001);
  const c = Array.from({ length: 60 }, () => Math.abs(normal(r, 3)));
  const d = Array.from({ length: 60 }, () => Math.abs(normal(r, 3)));
  assert.ok(wilcoxon(c, d).p > 0.01);
  assert.ok(Number.isNaN(wilcoxon([1, 2, 3], [2, 3, 4]).p)); // pocos datos: no se opina
});

function simulate(seed, { biasB = 0, noiseB = 3 } = {}) {
  const r = rng(seed);
  const lines = ["participant,exercise,side,hold_id,target_deg,rater1_deg,rater2_deg,model,camera_deg,visible_frac"];
  for (let p = 1; p <= 20; p++) for (const target of [30, 60, 90, 110, 130]) {
    const truth = target + normal(r, 4), r1 = truth + normal(r, 2), r2 = truth + normal(r, 2);
    const a = truth + normal(r, 3), b = truth + biasB + normal(r, noiseB);
    const id = `h${target}`;
    lines.push(`P${p},knee_flexion,left,${id},${target},${r1.toFixed(1)},${r2.toFixed(1)},mediapipe,${a.toFixed(1)},0.95`);
    lines.push(`P${p},knee_flexion,left,${id},${target},${r1.toFixed(1)},${r2.toFixed(1)},rtmpose,${b.toFixed(1)},0.95`);
  }
  return lines.join("\n");
}

test("analyze: un modelo bueno cumple los criterios y uno sesgado no", () => {
  const good = analyze(parseCsv(simulate(7)));
  const m = good.models["mediapipe/todos"];
  assert.equal(m.n, 100);
  assert.ok(m.pass.mae && m.pass.loa && m.pass.bias && m.pass.icc, JSON.stringify(m));
  assert.ok(good.raters.icc > 0.98);
  const bad = analyze(parseCsv(simulate(7, { biasB: 9, noiseB: 8 })));
  const b = bad.models["rtmpose/todos"];
  assert.ok(!b.pass.bias && !b.pass.mae);
  assert.ok(bad.comparison.p < 0.001); // y la comparación lo distingue
  assert.match(report(bad), /NO cumple/);
});

test("analyze: excluye sostenes con la articulación poco visible o sin dato, y lo informa", () => {
  const csv = `participant,exercise,side,hold_id,target_deg,rater1_deg,rater2_deg,model,camera_deg,visible_frac
P1,knee_flexion,left,a,90,90,91,rtmpose,89,0.9
P1,knee_flexion,left,b,90,90,91,rtmpose,89,0.2
P1,knee_flexion,left,c,90,90,91,rtmpose,,0.9`;
  const res = analyze(parseCsv(csv));
  assert.equal(res.total, 3);
  assert.equal(res.excluded, 2);
});

test("bootstrap por participante: el intervalo es más ancho que el ingenuo cuando hay sesgo propio de cada persona", () => {
  const r = rng(11);
  const cam = [], ref = [], who = [];
  for (let p = 0; p < 20; p++) {
    const own = normal(r, 4); // cada persona tiene su propio desfase (los 5 sostenes comparten el error)
    for (let h = 0; h < 5; h++) { const t = 30 + h * 25; ref.push(t); cam.push(t + own + normal(r, 1)); who.push(`P${p}`); }
  }
  const naive = blandAltman(cam, ref);
  const boot = clusterBootstrap(cam, ref, who, { reps: 1000 });
  const naiveWidth = naive.biasCI[1] - naive.biasCI[0];
  assert.ok(boot.bias[1] - boot.bias[0] > naiveWidth * 1.5, `boot ${boot.bias} ingenuo ${naive.biasCI}`);
  assert.equal(boot.participants, 20);
});
