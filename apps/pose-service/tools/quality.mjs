// Mide la CALIDAD de la señal de cada video/modelo/lado con reliability.js (el mismo código que usará la plataforma).
// Uso: node tools/quality.mjs   (lee pruebas-videos/out_*/{mediapipe,rtmpose}.json)
import fs from "node:fs";
import path from "node:path";
import { EXERCISES } from "../../tracking-prototype/src/angleMath.js";
import { runPosePass } from "../../tracking-prototype/src/videoPass.js";
import { assessReliability } from "../../tracking-prototype/src/reliability.js";

// carpeta de salida -> ejercicio medido, y si el video es un caso que la plataforma DEBE aceptar ("good") o rechazar ("bad")
const CASES = [
  // video de flexión de hombro filmado DE FRENTE: el brazo apunta a la cámara y el ángulo 2D no es fiable -> debe rechazarse
  { dir: "out_hombro", code: "shoulder_flexion", expect: "bad" },
  { dir: "out_slr", code: "straight_leg_raise", expect: "good" },
  { dir: "out_single_leg_squat", code: "knee_flexion", expect: "bad" },
  { dir: "out_codo1", code: "elbow_flexion", expect: "bad" },
  { dir: "out_codo2", code: "elbow_flexion", expect: "bad" },
];
const root = path.join(import.meta.dirname, "..", "pruebas-videos");

async function traceOf(file, exercise, side) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const frames = d.frames; let k = 0;
  const { trace } = await runPosePass({
    durationMs: frames.at(-1).t_ms, stepMs: d.step_ms, exercise, side, targetAngle: exercise.defaultTargetAngle, frame: { width: d.width, height: d.height },
    getLandmarks: (ms) => { while (k + 1 < frames.length && Math.abs(frames[k + 1].t_ms - ms) <= Math.abs(frames[k].t_ms - ms)) k++; return frames[k].landmarks; },
    meta: { model: path.basename(file, ".json") },
  });
  return trace;
}

const rows = [];
for (const c of CASES) {
  const exercise = EXERCISES[c.code];
  for (const model of ["mediapipe", "rtmpose"]) {
    for (const side of ["left", "right"]) {
      const trace = await traceOf(path.join(root, c.dir, `${model}.json`), exercise, side);
      const r = assessReliability(trace, exercise);
      rows.push({ caso: `${c.dir}/${side}`, modelo: model, ej: c.code, esperado: c.expect, veredicto: r.verdict, puntaje: r.score, fallas: r.failed.join(",") || "-", ...r.metrics });
    }
  }
}
console.table(rows.map((r) => ({ ...r, ej: undefined })));
