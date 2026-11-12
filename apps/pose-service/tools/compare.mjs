// Compara los registros de dos modelos (salida de extract.py) con el MISMO motor de análisis del proyecto.
// Uso: node tools/compare.mjs salida_dir knee_flexion [target_angle]
// Sin goniómetro NO mide exactitud: mide ACUERDO entre modelos, repeticiones detectadas y cuánto de la señal es utilizable.
import fs from "node:fs";
import path from "node:path";
import { EXERCISES, MIN_VISIBILITY } from "../../tracking-prototype/src/angleMath.js";
import { runPosePass } from "../../tracking-prototype/src/videoPass.js";
import { analyzeSession } from "../../tracking-prototype/src/analysis.js";

const [dir, code, targetArg] = process.argv.slice(2);
const exercise = EXERCISES[code];
if (!dir || !exercise) { console.error("uso: node tools/compare.mjs dir ejercicio [meta]"); process.exit(1); }
const target = Number(targetArg ?? exercise.defaultTargetAngle);

async function trace(model, side) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, `${model}.json`), "utf8"));
  const frames = d.frames; let k = 0;
  const { trace: t } = await runPosePass({
    durationMs: frames.at(-1).t_ms, stepMs: d.step_ms, exercise, side, targetAngle: target, frame: { width: d.width, height: d.height },
    getLandmarks: (ms) => { while (k + 1 < frames.length && Math.abs(frames[k + 1].t_ms - ms) <= Math.abs(frames[k].t_ms - ms)) k++; return frames[k].landmarks; },
    meta: { model },
  });
  return { t, analysis: analyzeSession(t, { expectedReps: null }) };
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function pearson(x, y) { const mx = mean(x), my = mean(y); let n = 0, dx = 0, dy = 0; for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return n / Math.sqrt(dx * dy); }

for (const side of ["left", "right"]) {
  const mp = await trace("mediapipe", side), rtm = await trace("rtmpose", side);
  console.log(`\n=== ${code} · lado ${side} ===`);
  for (const [name, r] of [["MediaPipe", mp], ["RTMPose  ", rtm]]) {
    const vis = r.t.vis.filter((v) => v >= MIN_VISIBILITY).length / r.t.vis.length;
    const reps = r.analysis.reps.map((x) => Math.round(x.angle));
    console.log(`${name}: articulación visible en ${(vis * 100).toFixed(0)} % de los cuadros · ${reps.length} repeticiones · mejores ángulos [${reps.join(", ")}]`);
  }
  const ts = new Map(mp.t.t.map((v, i) => [v, i]));
  const a = [], b = [];
  rtm.t.t.forEach((v, j) => { const i = ts.get(v); if (i !== undefined && mp.t.vis[i] >= MIN_VISIBILITY && rtm.t.vis[j] >= MIN_VISIBILITY) { a.push(mp.t.angle[i]); b.push(rtm.t.angle[j]); } });
  if (a.length < 10) { console.log("Muy pocos cuadros en común para comparar."); continue; }
  const diff = a.map((v, i) => v - b[i]);
  const mae = mean(diff.map(Math.abs)), bias = mean(diff), rmse = Math.sqrt(mean(diff.map((d) => d * d)));
  console.log(`Acuerdo en ${a.length} cuadros comunes: r = ${pearson(a, b).toFixed(3)} · error medio absoluto = ${mae.toFixed(1)}° · RMSE = ${rmse.toFixed(1)}° · sesgo (MP − RTM) = ${bias.toFixed(1)}°`);
  console.log(`Rango del ángulo: MediaPipe ${Math.min(...a).toFixed(0)}–${Math.max(...a).toFixed(0)}° · RTMPose ${Math.min(...b).toFixed(0)}–${Math.max(...b).toFixed(0)}°`);
}
