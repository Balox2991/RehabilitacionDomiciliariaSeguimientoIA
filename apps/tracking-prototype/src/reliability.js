/**
 * reliability.js
 * ------------------------------------------------------------------
 * ¿Se puede CONFIAR en el ángulo que midió la cámara? Antes de enseñarle un número a un paciente (o guardarlo en su historia)
 * hay que saber si la medición es creíble. Con una sola cámara en 2D falla cuando el cuerpo sale cortado, la persona está muy
 * lejos, el brazo se pega al torso o hay objetos delante. En esos casos un número falso es peor que ningún número.
 *
 * Este módulo mira SOLO el registro de la sesión (formato telerehab-trace/2) y responde con un veredicto y las causas:
 *   - "reliable":   mostrar ángulos y contar repeticiones.
 *   - "uncertain":  mostrar con reserva (rango aproximado) y pedir mejorar el encuadre.
 *   - "unreliable": NO mostrar ángulos ni repeticiones; dar consejos de encuadre y una guía visual para comparar.
 *
 * Puro: sin cámara, sin DOM, sin red. Los umbrales son ORIENTATIVOS: se calibraron con un puñado de videos (ver
 * docs/CALIDAD-DE-SENAL.md) y hay que revisarlos con la validación contra goniómetro; no son criterio clínico.
 */
import { MIN_VISIBILITY } from "./angleMath.js";

// Umbral de cada comprobación (pasa si el valor cumple). Ajustables.
export const THRESHOLDS = {
  visiblePct: { min: 85 },        // % de cuadros con la articulación visible
  scale: { min: 0.12 },           // largo del tronco / alto de la imagen: si es menor, la persona está muy lejos o muy pequeña
  limbVar: { max: 0.40 },         // variación del largo de los segmentos medidos (¿se deforma el esqueleto?)
  jumpPct: { max: 8 },            // % de saltos imposibles del ángulo entre lecturas seguidas
  implausiblePct: { max: 3 },     // % de lecturas fuera de lo que una articulación humana puede hacer
};
export const JUMP_DEG = 35;       // un salto mayor entre dos lecturas (~66 ms) no es movimiento humano: es un error del modelo

// Rango de ángulo (tal como lo mide el motor) que una persona puede alcanzar de verdad en cada ejercicio.
export const PLAUSIBLE_RANGE = {
  knee_flexion: [20, 182],
  elbow_flexion: [25, 182],
  shoulder_flexion: [0, 185],
  shoulder_abduction: [0, 185],
  straight_leg_raise: [0, 110],
};
const DEFAULT_RANGE = [0, 185];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
const round = (x, d = 2) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** Puntos del esqueleto que forman cada segmento medido (por nombre: hip, knee…), según el tipo de medida. */
function measuredSegments(exercise) {
  const m = exercise.spec?.measure ?? exercise.measure;
  if (!m) return [];
  if (m.type === "joint_angle") return [[m.points[0], m.points[1]], [m.points[1], m.points[2]]];
  return [[m.from, m.to]];
}

function skeletonPoint(trace, frame, name, side) {
  const j = trace.skeleton?.joints?.indexOf(`${side}_${name}`);
  if (j === undefined || j < 0) return null;
  const x = frame[j * 2], y = frame[j * 2 + 1];
  return x || y ? { x: (x / 1000) * trace.meta.width, y: (y / 1000) * trace.meta.height } : null;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Mide el registro. Devuelve las métricas crudas (sin juzgar). */
export function signalMetrics(trace, exercise) {
  const { meta, t = [], angle = [], vis = [] } = trace;
  const side = meta.side;
  const n = t.length;
  const valid = angle.map((a, i) => Number.isFinite(a) && (vis[i] ?? 1) >= MIN_VISIBILITY);
  const visiblePct = n ? (valid.filter(Boolean).length / n) * 100 : 0;

  // Saltos imposibles y lecturas fuera de rango, solo entre lecturas válidas y cercanas en el tiempo.
  let pairs = 0, jumps = 0, inRange = 0, outRange = 0;
  const [lo, hi] = PLAUSIBLE_RANGE[meta.exercise] ?? DEFAULT_RANGE;
  for (let i = 0; i < n; i++) {
    if (!valid[i]) continue;
    if (angle[i] < lo || angle[i] > hi) outRange++; else inRange++;
    if (i > 0 && valid[i - 1] && t[i] - t[i - 1] <= 150) { pairs++; if (Math.abs(angle[i] - angle[i - 1]) > JUMP_DEG) jumps++; }
  }
  const jumpPct = pairs ? (jumps / pairs) * 100 : 0;
  const implausiblePct = inRange + outRange ? (outRange / (inRange + outRange)) * 100 : 0;

  // Tamaño de la persona y deformación de los segmentos medidos, a partir del esqueleto guardado.
  const stride = trace.skeleton?.stride ?? 2;
  const frames = trace.skeleton?.frames ?? [];
  const segs = measuredSegments(exercise);
  const torsos = [];
  const lens = segs.map(() => []);
  frames.forEach((f, k) => {
    if ((vis[k * stride] ?? 1) < MIN_VISIBILITY) return; // cuadro sin la articulación a la vista: no sirve para medir
    const sh = ["left", "right"].map((s) => skeletonPoint(trace, f, "shoulder", s));
    const hp = ["left", "right"].map((s) => skeletonPoint(trace, f, "hip", s));
    if (!sh.every(Boolean) || !hp.every(Boolean)) return;
    const torso = dist({ x: (sh[0].x + sh[1].x) / 2, y: (sh[0].y + sh[1].y) / 2 }, { x: (hp[0].x + hp[1].x) / 2, y: (hp[0].y + hp[1].y) / 2 });
    if (!(torso > 1)) return;
    torsos.push(torso);
    segs.forEach(([a, b], s) => {
      const pa = skeletonPoint(trace, f, a, side), pb = skeletonPoint(trace, f, b, side);
      if (pa && pb) lens[s].push(dist(pa, pb) / torso);
    });
  });
  const torsoMedian = median(torsos);
  const scale = torsoMedian ? torsoMedian / meta.height : null; // null = no hay esqueleto guardado: no se puede juzgar
  // variación robusta: (percentil 90 − percentil 10) / mediana. Un segmento rígido casi no cambia de largo en el plano.
  const usable = lens.filter((l) => l.length > 5);
  const limbVar = usable.length ? Math.max(0, ...usable.map((l) => (quantile(l, 0.9) - quantile(l, 0.1)) / (median(l) || 1))) : null;

  return {
    visiblePct: round(visiblePct, 0), scale: round(scale, 3), limbVar: round(limbVar, 2), jumpPct: round(jumpPct, 1), implausiblePct: round(implausiblePct, 1),
  };
}

/** Códigos de falla -> qué decirle a la persona. Solo texto que ayuda a arreglar el problema. */
export const ADVICE = {
  visiblePct: "No se ve bien la articulación. Ponte de modo que se vea todo el brazo o la pierna, sin nada delante.",
  scale: "Estás muy lejos o muy pequeño en la imagen. Acércate o apoya el celular a 2 o 3 metros, con el cuerpo completo a la vista.",
  limbVar: "El cuerpo se está viendo deformado (el brazo o la pierna se pega al cuerpo o se cruza). Gírate para que el movimiento se vea de lado, sin que el brazo tape el torso.",
  jumpPct: "La cámara se pierde por momentos. Mejora la luz, usa ropa que contraste con el fondo y mantén el celular quieto.",
  implausiblePct: "Las medidas salen imposibles para esta articulación. Revisa que el cuerpo salga completo y que no haya objetos delante.",
};

/** @returns {{verdict:"reliable"|"uncertain"|"unreliable", score:number, failed:string[], metrics:object, advice:string[]}} */
export function assessReliability(trace, exercise, thresholds = THRESHOLDS) {
  const metrics = signalMetrics(trace, exercise);
  const failed = Object.keys(thresholds).filter((k) => {
    const v = metrics[k], th = thresholds[k];
    if (v === null || v === undefined) return k === "visiblePct"; // lo que no se pudo medir (sin esqueleto) no se juzga
    return (th.min !== undefined && v < th.min) || (th.max !== undefined && v > th.max);
  });
  const score = round(1 - failed.length / Object.keys(thresholds).length, 2);
  // Sin articulación visible no hay nada que medir; con una sola falla leve se muestra con reserva; con varias, se oculta.
  const verdict = failed.length === 0 ? "reliable" : failed.includes("visiblePct") || failed.length >= 2 ? "unreliable" : "uncertain";
  return { verdict, score, failed, metrics, advice: failed.map((k) => ADVICE[k]) };
}

/** Recorta el registro a los últimos `windowMs` ms (para juzgar cómo va la medición AHORA, no el promedio de toda la sesión). */
export function windowTrace(trace, windowMs) {
  const n = trace.t.length;
  if (!n) return trace;
  const from = trace.t[n - 1] - windowMs;
  let i0 = 0;
  while (i0 < n && trace.t[i0] < from) i0++;
  const stride = trace.skeleton?.stride ?? 2;
  const k0 = Math.ceil(i0 / stride);
  return {
    ...trace,
    t: trace.t.slice(i0), angle: trace.angle.slice(i0), vis: trace.vis.slice(i0),
    skeleton: trace.skeleton ? { ...trace.skeleton, frames: trace.skeleton.frames.slice(k0) } : trace.skeleton,
  };
}

/** Veredicto sobre los últimos segundos. Con menos de `minMs` de datos todavía no se puede juzgar: devuelve null. */
export function assessRecent(trace, exercise, { windowMs = 5000, minMs = 2500, thresholds = THRESHOLDS } = {}) {
  const n = trace?.t?.length ?? 0;
  if (n < 5 || trace.t[n - 1] - trace.t[0] < minMs) return null;
  return assessReliability(windowTrace(trace, windowMs), exercise, thresholds);
}
