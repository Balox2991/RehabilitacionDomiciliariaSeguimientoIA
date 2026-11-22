import { test } from "node:test";
import assert from "node:assert/strict";
import { loadReviewed, saveReviewed, taskFilters, visibleTasks } from "../src/lib/triage.js";

const tasks = [
  { id: 1, status: "sin_actividad" },
  { id: 2, status: "compensaciones" },
  { id: 3, status: "sin_actividad" },
  { id: 4, status: "en_meta" },
];

test("taskFilters: 'Todos' primero y solo los tipos que existen, con su conteo", () => {
  const f = taskFilters(tasks);
  assert.deepEqual(f.map((x) => [x.id, x.n]), [["todos", 4], ["sin_actividad", 2], ["compensaciones", 1], ["en_meta", 1]]);
});

test("visibleTasks: filtra por tipo y oculta los revisados (con su conteo)", () => {
  const r = visibleTasks(tasks, { filter: "sin_actividad", reviewed: [1] });
  assert.deepEqual(r.shown.map((p) => p.id), [3]);
  assert.equal(r.reviewedCount, 1);
});

test("visibleTasks: showReviewed los vuelve a mostrar", () => {
  assert.equal(visibleTasks(tasks, { reviewed: [1, 2], showReviewed: true }).shown.length, 4);
  assert.equal(visibleTasks(tasks, { reviewed: [1, 2] }).shown.length, 2);
});

test("el almacenamiento: guarda por día y paciente, ignora basura y no lanza si falla", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  saveReviewed(7, [1, 3], "2026-11-22", storage);
  assert.deepEqual(loadReviewed(7, "2026-11-22", storage), [1, 3]);
  assert.deepEqual(loadReviewed(7, "2026-11-23", storage), []); // otro día: empieza limpio
  assert.deepEqual(loadReviewed(8, "2026-11-22", storage), []); // otro fisioterapeuta
  mem.set("triage:7:2026-11-24", "{no es json");
  assert.deepEqual(loadReviewed(7, "2026-11-24", storage), []);
  const broken = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("lleno"); } };
  assert.deepEqual(loadReviewed(7, "2026-11-22", broken), []);
  assert.doesNotThrow(() => saveReviewed(7, [1], "2026-11-22", broken));
});
