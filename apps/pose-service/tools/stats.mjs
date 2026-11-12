// Estadística de concordancia para validar la medición con cámara contra el goniómetro (sin dependencias).
// Referencias del método: Bland y Altman 1986 (límites de acuerdo), Koo y Li 2016 (ICC(2,1)), Wilcoxon (comparar errores).

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
export const median = (a) => { const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

export function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy);
}

/** Bland-Altman: sesgo, desviación de las diferencias, límites de acuerdo 95 % con su intervalo de confianza aproximado. */
export function blandAltman(a, b) {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length, bias = mean(d), s = sd(d);
  const lo = bias - 1.96 * s, hi = bias + 1.96 * s;
  const seLoa = s * Math.sqrt(1 / n + (1.96 ** 2) / (2 * (n - 1))); // error estándar de cada límite
  const seBias = s / Math.sqrt(n);
  // Sesgo proporcional: pendiente de la regresión de la diferencia sobre la media de cada par.
  const m = a.map((v, i) => (v + b[i]) / 2);
  const mm = mean(m), md = mean(d);
  const slope = m.reduce((s2, v, i) => s2 + (v - mm) * (d[i] - md), 0) / m.reduce((s2, v) => s2 + (v - mm) ** 2, 0);
  return { n, bias, sd: s, loa: [lo, hi], loaCI: { lo: [lo - 1.96 * seLoa, lo + 1.96 * seLoa], hi: [hi - 1.96 * seLoa, hi + 1.96 * seLoa] },
    biasCI: [bias - 1.96 * seBias, bias + 1.96 * seBias], proportionalSlope: slope };
}

/** Errores absolutos: media, RMSE y porcentaje dentro de ±5° y ±10°. */
export function errorSummary(a, b) {
  const e = a.map((v, i) => Math.abs(v - b[i]));
  return { mae: mean(e), rmse: Math.sqrt(mean(a.map((v, i) => (v - b[i]) ** 2))), within5: e.filter((x) => x <= 5).length / e.length, within10: e.filter((x) => x <= 10).length / e.length };
}

/** ICC(2,1): efectos aleatorios de dos vías, acuerdo absoluto, una medición. `cols` = lista de k arreglos de n valores. */
export function icc21(...cols) {
  const k = cols.length, n = cols[0].length;
  const grand = mean(cols.flat());
  const rowMeans = Array.from({ length: n }, (_, i) => mean(cols.map((c) => c[i])));
  const colMeans = cols.map(mean);
  const msr = k * rowMeans.reduce((s, r) => s + (r - grand) ** 2, 0) / (n - 1);
  const msc = n * colMeans.reduce((s, c) => s + (c - grand) ** 2, 0) / (k - 1);
  let sse = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) sse += (cols[j][i] - rowMeans[i] - colMeans[j] + grand) ** 2;
  const mse = sse / ((n - 1) * (k - 1));
  return (msr - mse) / (msr + (k - 1) * mse + (k * (msc - mse)) / n);
}

/** Wilcoxon de rangos con signo (aproximación normal con corrección de empates). Devuelve p bilateral. Requiere n >= 10 pares útiles. */
export function wilcoxon(x, y) {
  const d = x.map((v, i) => v - y[i]).filter((v) => v !== 0);
  const n = d.length;
  if (n < 10) return { n, p: NaN };
  const idx = d.map((v, i) => [Math.abs(v), i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(n);
  let tieTerm = 0;
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) ranks[idx[t][1]] = r;
    const c = j - i + 1;
    tieTerm += c ** 3 - c;
    i = j + 1;
  }
  const wPlus = d.reduce((s, v, i) => s + (v > 0 ? ranks[i] : 0), 0);
  const mu = (n * (n + 1)) / 4;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieTerm / 48);
  const z = (wPlus - mu) / sigma;
  return { n, z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

function normalCdf(z) { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * z), poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - (Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)) * poly;
}

/**
 * Bootstrap por participante (remuestrea participantes completos): los sostenes de una misma persona no son independientes,
 * así que el intervalo "ingenuo" de Bland-Altman es demasiado estrecho. Devuelve IC95 percentil del sesgo y de los límites.
 */
export function clusterBootstrap(a, b, clusters, { reps = 2000, seed = 1 } = {}) {
  let s = seed;
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = [...new Set(clusters)];
  const byId = new Map(ids.map((id) => [id, []]));
  clusters.forEach((c, i) => byId.get(c).push(a[i] - b[i]));
  const bias = [], lo = [], hi = [];
  for (let r = 0; r < reps; r++) {
    const d = [];
    for (let k = 0; k < ids.length; k++) d.push(...byId.get(ids[Math.floor(rnd() * ids.length)]));
    const m = mean(d), sdv = sd(d);
    bias.push(m); lo.push(m - 1.96 * sdv); hi.push(m + 1.96 * sdv);
  }
  const ci = (v) => { const x = [...v].sort((p, q) => p - q); return [x[Math.floor(0.025 * reps)], x[Math.ceil(0.975 * reps) - 1]]; };
  return { bias: ci(bias), loaLo: ci(lo), loaHi: ci(hi), participants: ids.length };
}
