// Análisis de la validación contra goniómetro. Uso: node tools/validate.mjs registro.csv
//
// CSV (una fila por sostén y por modelo; ver docs/validacion/plantilla-registro.csv):
//   participant,exercise,side,hold_id,target_deg,rater1_deg,rater2_deg,model,camera_deg,visible_frac
// Los grados son FLEXIÓN clínica (0° = extendido), tanto del goniómetro como de la cámara.
// Criterios de aceptación fijados ANTES de ver los datos (ver protocolo, sección 8).
import fs from "node:fs";
import { blandAltman, clusterBootstrap, errorSummary, icc21, mean, pearson, sd, wilcoxon } from "./stats.mjs";

export const CRITERIA = { maxMae: 5, maxLoaHalfWidth: 10, maxAbsBias: 3, minIcc: 0.9, minVisible: 0.5 };

export function parseCsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const cols = head.split(",").map((c) => c.trim());
  return rows.map((r) => Object.fromEntries(r.split(",").map((v, i) => [cols[i], v.trim()])));
}

export function analyze(records) {
  const num = (v) => (v === undefined || v === null || String(v).trim() === "" ? NaN : Number(v)); // celda vacía = sin dato (no 0)
  const rows = records.map((r) => ({ ...r, rater1: num(r.rater1_deg), rater2: num(r.rater2_deg), cam: num(r.camera_deg), vis: num(r.visible_frac) }));
  const usable = rows.filter((r) => [r.rater1, r.rater2, r.cam].every(Number.isFinite) && !(r.vis < CRITERIA.minVisible));
  const excluded = rows.length - usable.length;
  const out = { total: rows.length, excluded, models: {}, raters: null, comparison: null };

  // Techo de la prueba: cuánto coinciden dos fisioterapeutas con el mismo goniómetro (la cámara no puede pedirse más exacta que eso).
  const byHold = new Map();
  for (const r of usable) byHold.set(`${r.participant}|${r.exercise}|${r.side}|${r.hold_id}`, r);
  const uniq = [...byHold.values()];
  if (uniq.length >= 3) {
    const a = uniq.map((r) => r.rater1), b = uniq.map((r) => r.rater2);
    out.raters = { n: uniq.length, icc: icc21(a, b), ...errorSummary(a, b), bias: mean(a.map((v, i) => v - b[i])) };
  }

  for (const model of [...new Set(usable.map((r) => r.model))]) {
    for (const exercise of ["todos", ...new Set(usable.map((r) => r.exercise))]) {
      const set = usable.filter((r) => r.model === model && (exercise === "todos" || r.exercise === exercise));
      if (set.length < 5) continue;
      const ref = set.map((r) => (r.rater1 + r.rater2) / 2), cam = set.map((r) => r.cam);
      const ba = blandAltman(cam, ref), err = errorSummary(cam, ref), icc = icc21(cam, ref);
      const halfWidth = (ba.loa[1] - ba.loa[0]) / 2;
      out.models[`${model}/${exercise}`] = {
        n: set.length, participants: new Set(set.map((r) => r.participant)).size, bias: ba.bias, biasCI: ba.biasCI, sdDiff: ba.sd, loa: ba.loa, loaCI: ba.loaCI,
        proportionalSlope: ba.proportionalSlope, r: pearson(cam, ref), icc, ...err,
        boot: clusterBootstrap(cam, ref, set.map((r) => r.participant)),
        pass: { mae: err.mae <= CRITERIA.maxMae, loa: halfWidth <= CRITERIA.maxLoaHalfWidth, bias: Math.abs(ba.bias) <= CRITERIA.maxAbsBias, icc: icc >= CRITERIA.minIcc },
      };
    }
  }

  // Comparación entre modelos: mismos sostenes, error absoluto contra la referencia (Wilcoxon pareado).
  const models = [...new Set(usable.map((r) => r.model))];
  if (models.length === 2) {
    const key = (r) => `${r.participant}|${r.exercise}|${r.side}|${r.hold_id}`;
    const m0 = new Map(usable.filter((r) => r.model === models[0]).map((r) => [key(r), r]));
    const e0 = [], e1 = [];
    for (const r of usable.filter((x) => x.model === models[1])) {
      const o = m0.get(key(r));
      if (o) { e0.push(Math.abs(o.cam - (o.rater1 + o.rater2) / 2)); e1.push(Math.abs(r.cam - (r.rater1 + r.rater2) / 2)); }
    }
    if (e0.length) out.comparison = { models, pairs: e0.length, maeA: mean(e0), maeB: mean(e1), sdA: sd(e0), sdB: sd(e1), ...wilcoxon(e0, e1) };
  }
  return out;
}

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const ok = (b) => (b ? "CUMPLE" : "NO cumple");

export function report(res) {
  const L = [];
  L.push(`Registros: ${res.total} · excluidos (falta dato o articulación poco visible): ${res.excluded}`);
  if (res.raters) L.push(`\nTecho del goniómetro (2 evaluadores, ${res.raters.n} sostenes): ICC = ${f(res.raters.icc, 3)} · diferencia absoluta media = ${f(res.raters.mae)}° · sesgo entre evaluadores = ${f(res.raters.bias)}°`);
  for (const [name, m] of Object.entries(res.models)) {
    L.push(`\n== ${name} · n = ${m.n} sostenes, ${m.participants} participantes ==`);
    L.push(`  Sesgo (cámara − goniómetro): ${f(m.bias)}° (IC95 ${f(m.biasCI[0])} a ${f(m.biasCI[1])}) · ${ok(m.pass.bias)} (|sesgo| ≤ ${CRITERIA.maxAbsBias}°)`);
    L.push(`  Límites de acuerdo 95 %: ${f(m.loa[0])}° a ${f(m.loa[1])}° (IC95 del límite inferior ${f(m.loaCI.lo[0])} a ${f(m.loaCI.lo[1])}; del superior ${f(m.loaCI.hi[0])} a ${f(m.loaCI.hi[1])}) · ${ok(m.pass.loa)} (±${CRITERIA.maxLoaHalfWidth}°)`);
    L.push(`  Con remuestreo por participante (los sostenes de una persona no son independientes): sesgo IC95 ${f(m.boot.bias[0])} a ${f(m.boot.bias[1])} · límite inferior ${f(m.boot.loaLo[0])} a ${f(m.boot.loaLo[1])} · límite superior ${f(m.boot.loaHi[0])} a ${f(m.boot.loaHi[1])}`);
    L.push(`  Error absoluto medio: ${f(m.mae)}° · ${ok(m.pass.mae)} (≤ ${CRITERIA.maxMae}°) · RMSE ${f(m.rmse)}° · dentro de ±5°: ${f(m.within5 * 100, 0)} % · dentro de ±10°: ${f(m.within10 * 100, 0)} %`);
    L.push(`  ICC(2,1) = ${f(m.icc, 3)} · ${ok(m.pass.icc)} (≥ ${CRITERIA.minIcc}) · r = ${f(m.r, 3)} · pendiente del sesgo proporcional = ${f(m.proportionalSlope, 3)} °/°`);
  }
  if (res.comparison) {
    const c = res.comparison;
    L.push(`\n== ${c.models[0]} vs ${c.models[1]} · ${c.pairs} sostenes comunes ==`);
    L.push(`  Error absoluto medio: ${f(c.maeA)}° vs ${f(c.maeB)}° · Wilcoxon pareado: p = ${Number.isFinite(c.p) ? c.p.toFixed(4) : "n/d (menos de 10 pares con diferencia)"}`);
  }
  L.push("\nLos criterios son los del protocolo (sección 8). Cumplir los cuatro en el modelo y ejercicio indica acuerdo suficiente en ESTA muestra; no demuestra validez clínica en pacientes.");
  return L.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("validate.mjs")) {
  const file = process.argv[2];
  if (!file) { console.error("uso: node tools/validate.mjs registro.csv"); process.exit(1); }
  console.log(report(analyze(parseCsv(fs.readFileSync(file, "utf8")))));
}
