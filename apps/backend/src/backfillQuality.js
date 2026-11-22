// Calcula la calidad de las sesiones guardadas ANTES de la migración 7 (solo las que tienen registro y aún no tienen calidad).
// Uso: node src/backfillQuality.js [ruta-a-la-base]   (por defecto data/telerehab.db). Es seguro repetirlo.
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { assessReliability } from "./engine.js";

const file = process.argv[2] ?? fileURLToPath(new URL("../data/telerehab.db", import.meta.url));
const db = new DatabaseSync(file);
const rows = db.prepare(
  `SELECT s.id, e.spec, a.trace FROM sessions s JOIN exercises e ON e.id = s.exercise_id
     JOIN session_analysis a ON a.session_id = s.id WHERE s.quality IS NULL`
).all();
const upd = db.prepare("UPDATE sessions SET quality = ? WHERE id = ?");
const count = {};
for (const r of rows) {
  const q = assessReliability(JSON.parse(r.trace), { spec: r.spec ? JSON.parse(r.spec) : null });
  upd.run(JSON.stringify({ verdict: q.verdict, score: q.score, failed: q.failed, metrics: q.metrics }), r.id);
  count[q.verdict] = (count[q.verdict] ?? 0) + 1;
}
console.log(`${rows.length} sesiones con registro y sin calidad →`, count);
