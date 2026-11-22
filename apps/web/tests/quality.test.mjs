import test from "node:test";
import assert from "node:assert/strict";
import { qualityView, smoothMode, sessionQualityNote, STABLE_READS } from "../src/lib/quality.js";

const ASSESS = (verdict, advice = ["Acércate."]) => ({ verdict, advice });

test("confiable o sin datos: pantalla normal, sin avisos", () => {
  assert.deepEqual(qualityView(null), { mode: "ok", headline: null, tips: [] });
  assert.equal(qualityView(ASSESS("reliable", [])).mode, "ok");
});

test("dudoso: se muestra con reserva y un consejo", () => {
  const v = qualityView(ASSESS("uncertain", ["a", "b", "c"]));
  assert.equal(v.mode, "approx");
  assert.deepEqual(v.tips, ["a", "b"]);
  assert.match(v.headline, /aproximada/);
});

test("no confiable: se ocultan ángulos y se explica por qué", () => {
  const v = qualityView(ASSESS("unreliable"));
  assert.equal(v.mode, "hidden");
  assert.match(v.headline, /no puedo medirte/i);
  assert.ok(v.tips.length >= 1);
});

test("el modo cambia solo tras lecturas seguidas iguales (sin parpadeo)", () => {
  let memo = { mode: "ok", pending: null, count: 0 };
  memo = smoothMode(memo, "hidden");
  assert.equal(memo.mode, "ok", "una sola lectura mala no oculta nada");
  memo = smoothMode(memo, "ok");
  assert.equal(memo.pending, null, "volver a ok reinicia la cuenta");
  for (let i = 0; i < STABLE_READS; i++) memo = smoothMode(memo, "hidden");
  assert.equal(memo.mode, "hidden");
});

test("nota final de la sesión: nada si fue confiable, aviso claro si no", () => {
  assert.equal(sessionQualityNote(ASSESS("reliable")), null);
  assert.equal(sessionQualityNote(null), null);
  assert.match(sessionQualityNote(ASSESS("unreliable", ["Acércate."])), /no son fiables.*Acércate/);
  assert.match(sessionQualityNote(ASSESS("uncertain", ["Acércate."])), /aproximados/);
});
