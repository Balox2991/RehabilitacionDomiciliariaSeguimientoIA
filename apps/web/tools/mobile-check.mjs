// Revisión de la web en tamaño de celular (emulación con Chrome real): recorre las pantallas del paciente y del
// fisioterapeuta, guarda capturas y avisa si alguna tiene desborde horizontal. NO sustituye probar en un celular real.
// Requisitos: la demo corriendo (iniciar-demo.ps1), Chrome instalado y `npm i --no-save playwright-core` en esta carpeta.
// Uso: node tools/mobile-check.mjs [carpeta_capturas] [ancho] [alto]     (por defecto 390x844)
// Ojo: cada corrida inicia sesión ~3 veces; el límite de intentos de la API (20 por 15 min por conexión) puede bloquear
// corridas seguidas: reinicia la API si pasa.
import { chromium } from "playwright-core";
import fs from "node:fs";

const PW = fs.readFileSync(new URL("../../backend/data/demo-credentials.txt", import.meta.url), "utf8").match(/todas: (\S+)/)[1];
const out = process.argv[2] ?? "shots";
const W = Number(process.argv[3] ?? 390), H = Number(process.argv[4] ?? 844);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

async function session(email, pages) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "es-CO" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("http://localhost:5173/");
  await page.fill("#login-email", email);
  await page.fill("#login-password", PW);
  await page.click(".auth-submit");
  await page.waitForURL((u) => !/^\/$/.test(u.pathname), { timeout: 15000 });
  for (const [name, path, action] of pages) {
    await page.goto("http://localhost:5173" + path);
    await page.waitForLoadState("networkidle");
    if (action) await action(page);
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => {
      const de = document.documentElement;
      const bad = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > de.clientWidth + 1 && getComputedStyle(el).position !== "fixed") bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} (${Math.round(r.right)}px)`);
      }
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, bad: [...new Set(bad)].slice(0, 6) };
    });
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    console.log(over.scrollW > over.clientW + 1 ? "DESBORDE" : "ok      ", name.padEnd(22), `scroll ${over.scrollW}/${over.clientW}`, over.bad.join(" | "));
  }
  if (errors.length) console.log("  errores de consola:", [...new Set(errors)].slice(0, 4));
  await ctx.close();
}

// Pantalla de ingreso (sin sesión)
{
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/00-login.png`, fullPage: true });
  const o = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  console.log(o[0] > o[1] + 1 ? "DESBORDE" : "ok      ", "00-login".padEnd(22), `scroll ${o[0]}/${o[1]}`);
  await ctx.close();
}

await session("andres.mejia@ejemplo.co", [
  ["p1-inicio", "/paciente/2"],
  ["p2-progreso", "/paciente/2/progreso"],
  ["p3-rutinas", "/paciente/2/rutinas"],
  ["p4-aprender", "/paciente/2/aprender"],
  ["p5-ejercicio", "/paciente/2/ejercicio/1"],
  ["p6-subir-video", "/paciente/2/ejercicio/1", async (pg) => { await pg.getByRole("button", { name: /Tengo un video grabado/ }).click(); }],
]);
await session("camila.restrepo@ejemplo.co", [
  ["t1-resumen", "/fisio/1"],
  ["t2-pacientes", "/fisio/1/pacientes"],
  ["t3-paciente", "/fisio/1/paciente/2"],
  ["t4-plan", "/fisio/1/paciente/2/plan"],
  ["t5-sesiones", "/fisio/1/paciente/2/sesiones"],
  ["t6-informe", "/fisio/1/paciente/2/informe"],
  ["t7-datos", "/fisio/1/paciente/2/datos"],
  ["t8-cuentas", "/fisio/1/cuentas"],
  ["t9-biblioteca", "/fisio/1/biblioteca"],
]);
await browser.close();
