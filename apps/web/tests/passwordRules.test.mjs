import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordProblem, suggestPassword } from "../src/lib/passwordRules.js";

test("reglas de contraseña (las mismas que el servidor)", () => {
  assert.ok(passwordProblem(""));
  assert.ok(passwordProblem("corta1"));
  assert.ok(passwordProblem("sololetrasenorme"));
  assert.ok(passwordProblem("12345678901"));
  assert.ok(passwordProblem("andres.mejia-2026x", "andres.mejia@ejemplo.co")); // contiene su correo
  assert.equal(passwordProblem("Clave-Segura-123", "otra@ejemplo.co"), null);
});

test("la contraseña sugerida siempre cumple las reglas y no usa caracteres ambiguos", () => {
  for (let i = 0; i < 200; i++) {
    const p = suggestPassword();
    assert.equal(passwordProblem(p), null, p);
    assert.match(p, /^[a-hjkmnp-z]{8}-[2-9]{4}$/);
  }
  assert.notEqual(suggestPassword(), suggestPassword());
});
