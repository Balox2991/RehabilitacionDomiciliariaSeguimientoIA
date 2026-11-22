// Qué le mostramos al paciente según la calidad de la medición. Puro (se prueba con Node).
// Regla de oro: si no podemos respaldar un ángulo, NO se muestra; en su lugar van el consejo y la guía para comparar.
//   ok     → ángulos y repeticiones normales
//   approx → se muestran con reserva («≈») y un consejo para mejorar el encuadre
//   hidden → sin ángulos ni repeticiones: consejo + muñeco de referencia para comparar la postura a ojo

const HEADLINE = {
  ok: null,
  approx: "Medición aproximada",
  hidden: "Todavía no puedo medirte con seguridad",
};

/** Cuántas lecturas seguidas iguales hacen falta para cambiar de modo (evita que la pantalla parpadee). */
export const STABLE_READS = 2;

/** @param {{verdict:string, advice:string[]}|null} assessment  resultado de assessReliability (null = aún sin datos) */
export function qualityView(assessment) {
  if (!assessment) return { mode: "ok", headline: null, tips: [] };
  const mode = assessment.verdict === "reliable" ? "ok" : assessment.verdict === "uncertain" ? "approx" : "hidden";
  return { mode, headline: HEADLINE[mode], tips: assessment.advice.slice(0, 2) };
}

/** Suaviza el modo: cambia solo tras `STABLE_READS` lecturas seguidas del mismo modo nuevo. `memo` = {mode, pending, count}. */
export function smoothMode(memo, nextMode) {
  if (nextMode === memo.mode) return { mode: memo.mode, pending: null, count: 0 };
  const count = memo.pending === nextMode ? memo.count + 1 : 1;
  return count >= STABLE_READS ? { mode: nextMode, pending: null, count: 0 } : { mode: memo.mode, pending: nextMode, count };
}

/** Mensaje final de la sesión según la calidad de TODA la medición (null = no hace falta decir nada). */
export function sessionQualityNote(assessment) {
  if (!assessment || assessment.verdict === "reliable") return null;
  const tip = assessment.advice[0] ?? "";
  return assessment.verdict === "unreliable"
    ? `Los ángulos de esta sesión no son fiables, así que no te los mostramos como si lo fueran. Para la próxima: ${tip}`
    : `Algunos ángulos de esta sesión son aproximados. Para la próxima: ${tip}`;
}
