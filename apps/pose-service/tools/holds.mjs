// Ángulo de cada sostén medido por la cámara, para cada modelo. Uso:
//   node tools/holds.mjs salida_extract ejercicio lado sostenes.csv > camara.csv
// salida_extract = carpeta de tools/extract.py (mediapipe.json y rtmpose.json) de UN video.
// sostenes.csv: hold_id,start_s,end_s   (la ventana ESTABLE del sostén, p. ej. los 3 s centrales de 5 s)
// Imprime: hold_id,model,camera_deg,visible_frac   (camera_deg = FLEXIÓN clínica, 0° = extendido; mediana de la ventana)
import fs from "node:fs";
import path from "node:path";
import { EXERCISES, MIN_VISIBILITY, measureJoint } from "../../tracking-prototype/src/angleMath.js";
import { median } from "./stats.mjs";

const [dir, code, side, holdsFile] = process.argv.slice(2);
const exercise = EXERCISES[code];
if (!exercise || !["left", "right"].includes(side) || !holdsFile) {
  console.error("uso: node tools/holds.mjs salida_extract ejercicio left|right sostenes.csv");
  process.exit(1);
}
const holds = fs.readFileSync(holdsFile, "utf8").trim().split(/\r?\n/).slice(1).map((l) => { const [id, a, b] = l.split(","); return { id: id.trim(), a: Number(a) * 1000, b: Number(b) * 1000 }; });
const flex = (angle) => (exercise.direction === "decreasing" ? 180 - angle : angle); // misma regla que el backend

console.log("hold_id,model,camera_deg,visible_frac");
for (const model of ["mediapipe", "rtmpose"]) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, `${model}.json`), "utf8"));
  for (const h of holds) {
    const inWin = d.frames.filter((f) => f.t_ms >= h.a && f.t_ms <= h.b);
    const reads = inWin.map((f) => (f.landmarks ? measureJoint(exercise, f.landmarks, side, { width: d.width, height: d.height }) : null));
    const good = reads.filter((r) => r && Number.isFinite(r.angle) && r.visibility >= MIN_VISIBILITY);
    const vis = inWin.length ? good.length / inWin.length : 0;
    console.log(`${h.id},${model},${good.length ? flex(median(good.map((r) => r.angle))).toFixed(1) : ""},${vis.toFixed(2)}`);
  }
}
