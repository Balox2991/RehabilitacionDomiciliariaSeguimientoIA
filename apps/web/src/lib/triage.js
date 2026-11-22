// Triaje de «Pendientes de hoy»: filtrar por tipo de pendiente y marcar pacientes como revisados.
// Lo revisado se recuerda SOLO por hoy y solo en este navegador (si mañana el paciente sigue igual, vuelve a aparecer).
// Puro salvo load/save, que tragan cualquier error del almacenamiento (modo privado, bloqueado, lleno).
import { STATUS } from "./format.js";

export const TASK_KINDS = ["sin_actividad", "compensaciones", "en_meta", "sin_plan"];

/** Chips de filtro con cuántos pendientes hay de cada tipo (solo los que tienen al menos uno). */
export function taskFilters(tasks) {
  const count = (k) => tasks.filter((p) => p.status === k).length;
  return [
    { id: "todos", label: "Todos", n: tasks.length },
    ...TASK_KINDS.filter((k) => count(k) > 0).map((k) => ({ id: k, label: STATUS[k].label, n: count(k) })),
  ];
}

/** @returns {{ shown: object[], reviewedCount: number }} `shown` respeta el filtro; los revisados salen salvo `showReviewed`. */
export function visibleTasks(tasks, { filter = "todos", reviewed = [], showReviewed = false } = {}) {
  const done = new Set(reviewed);
  const byKind = tasks.filter((p) => filter === "todos" || p.status === filter);
  return {
    shown: showReviewed ? byKind : byKind.filter((p) => !done.has(p.id)),
    reviewedCount: byKind.filter((p) => done.has(p.id)).length,
  };
}

const keyFor = (tid, day) => `triage:${tid}:${day}`;
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function loadReviewed(tid, day = today(), storage = globalThis.localStorage) {
  try {
    const v = JSON.parse(storage.getItem(keyFor(tid, day)) ?? "[]");
    return Array.isArray(v) ? v.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

export function saveReviewed(tid, ids, day = today(), storage = globalThis.localStorage) {
  try {
    storage.setItem(keyFor(tid, day), JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: queda solo en memoria durante la visita */
  }
}
