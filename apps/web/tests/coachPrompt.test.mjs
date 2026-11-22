import { test } from "node:test";
import assert from "node:assert/strict";
import { coachPrompt, goalFraction } from "../src/lib/coachPrompt.js";

const prog = (o = {}) => ({ complete: false, repInSet: 0, set: 1, sets: 3, ...o });
const base = { phase: "running", running: true, calibrated: true, visible: true, reps: 0, prog: prog() };

test("cámara apagada: la acción es encenderla; cargando: sin acción", () => {
  assert.equal(coachPrompt({ ...base, running: false, phase: "idle" }).action, "start");
  assert.equal(coachPrompt({ ...base, running: false, phase: "loading" }).action, null);
});
test("sin calibrar: pide calibrar; contando: espera", () => {
  assert.equal(coachPrompt({ ...base, calibrated: false }).action, "calibrate");
  assert.equal(coachPrompt({ ...base, calibrated: false, counting: true }).id, "counting");
});
test("medición no fiable o sin verte tiene prioridad sobre calibrar y sobre contar", () => {
  assert.equal(coachPrompt({ ...base, hidden: true, calibrated: false }).id, "hidden");
  assert.equal(coachPrompt({ ...base, visible: false }).id, "invisible");
});
test("flujo normal: empieza, va contando, descansa entre series y al final guarda", () => {
  assert.equal(coachPrompt(base).id, "go");
  assert.equal(coachPrompt({ ...base, reps: 3, prog: prog({ repInSet: 3 }) }).id, "doing");
  const rest = coachPrompt({ ...base, reps: 10, prog: prog({ repInSet: 0, set: 2 }) });
  assert.equal(rest.id, "rest");
  assert.match(rest.title, /Serie 1/);
  const done = coachPrompt({ ...base, reps: 30, prog: prog({ complete: true, set: 3 }) });
  assert.equal(done.action, "save");
  assert.equal(done.tone, "done");
});
test("goalFraction: acota a 0–1 y devuelve null sin lectura o sin meta", () => {
  assert.equal(goalFraction(45, 90), 0.5);
  assert.equal(goalFraction(200, 90), 1);
  assert.equal(goalFraction(-5, 90), 0);
  assert.equal(goalFraction(null, 90), null);
  assert.equal(goalFraction(10, 0), null);
});
