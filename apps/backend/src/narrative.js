// Resumen redactado del informe de evolución. NO es un modelo generativo: son plantillas de texto con reglas fijas sobre los
// números del informe (mismo criterio que el asistente de recuperación: explicable, probado, sin inventar nada clínico).
// El texto siempre dice que es un resumen automático que el fisioterapeuta debe revisar.

export const NOISE_FLOOR_DEG = 4; // igual que el asistente (COACH.noiseFloorDeg): menos que esto es ruido de la cámara

const sideText = (s) => (s === "left" ? "izquierdo" : s === "right" ? "derecho" : "");
const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);

function planSentence(p) {
  const name = `${p.exercise_name.toLowerCase()}${sideText(p.side) ? ` (lado ${sideText(p.side)})` : ""}`;
  if (!p.sessions) return `En ${name} todavía no hay sesiones registradas.`;
  const base = num(p.baseline_flexion), last = num(p.latest_flexion), meta = num(p.target_flexion);
  if (base == null || last == null) return `En ${name} hay ${p.sessions} sesión(es), sin una medición válida con cámara.`;
  const change = p.change_flexion;
  let text = `En ${name} la flexión pasó de ${base}° en la primera sesión a ${last}° en la última, con ${p.sessions} sesiones.`;
  if (Math.abs(change) < NOISE_FLOOR_DEG) {
    text += ` El cambio (${change > 0 ? "+" : ""}${num(change)}°) está dentro del margen de error de la medición con cámara (unos 3 a 5°), así que no puede leerse como mejora ni como retroceso.`;
  } else if (change > 0) {
    text += ` Es una mejora de ${num(change)}°, mayor que el margen de error de la cámara.`;
  } else {
    text += ` Es una disminución de ${num(-change)}°, mayor que el margen de error de la cámara: conviene revisarla con el paciente.`;
  }
  if (meta != null) text += p.progress_pct != null ? ` La meta es ${meta}° (${Math.round(p.progress_pct)} % de avance).` : ` La meta es ${meta}°.`;
  return text;
}

/** @returns {string[]} párrafos cortos, en orden de lectura. */
export function reportNarrative(report) {
  const { patient, summary, plans } = report;
  const out = [];
  const days = patient.days_since_injury != null ? ` Lleva ${patient.days_since_injury} días desde la lesión.` : "";
  out.push(`${patient.name}${patient.fracture_site ? `, con lesión en ${patient.fracture_site.toLowerCase()}` : ""}.${days} Tiene ${summary.sessions} sesiones registradas (${summary.reps} repeticiones).`);

  for (const p of plans) out.push(planSentence(p));

  const adh = summary.adherence_8w_pct;
  if (adh != null) {
    const level = adh >= 80 ? "alta" : adh >= 50 ? "parcial" : "baja";
    out.push(`La adherencia al plan en las últimas 8 semanas fue ${level} (${Math.round(adh)} % de las sesiones previstas).${level === "baja" ? " Conviene explorar con el paciente qué le dificulta hacer los ejercicios." : ""}`);
  }
  const comp = summary.compensation_rate_30d_pct;
  if (comp != null && comp >= 30) {
    out.push(`En los últimos 30 días el ${Math.round(comp)} % de las repeticiones tuvo alertas de postura (compensación): puede convenir reforzar la técnica o una cita presencial de control.`);
  }
  out.push("Resumen automático hecho con reglas fijas sobre las mediciones con cámara, que son estimaciones con margen de error. No es un diagnóstico ni reemplaza la valoración del fisioterapeuta, quien debe revisarlo antes de usarlo.");
  return out;
}
