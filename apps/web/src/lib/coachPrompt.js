// ¿Qué debe hacer la persona AHORA? Un solo mensaje, el más importante, según el momento de la sesión.
// Puro (sin DOM): la pantalla de práctica lo pinta como una barra de acción con el botón que toca en ese momento.
//
// Entrada: { phase, running, calibrated, counting, hidden, visible, reps, prog:{complete,repInSet,set,sets}, saving }
// Salida:  { id, tone: "idle"|"info"|"go"|"warn"|"rest"|"done", title, text, action: null|"start"|"calibrate"|"save" }
export function coachPrompt({ phase, running, calibrated, counting = false, hidden = false, visible = true, reps = 0, prog, saving = false }) {
  if (phase === "loading") return { id: "loading", tone: "info", title: "Preparando la cámara…", text: "Un momento, cargando el modelo de movimiento.", action: null };
  if (!running) return { id: "off", tone: "idle", title: "Vamos a empezar", text: "Enciende la cámara. Nada de video sale de tu dispositivo.", action: "start" };
  if (counting) return { id: "counting", tone: "info", title: "Quédate quieto", text: "Midiendo tu postura de reposo…", action: null };
  if (hidden) return { id: "hidden", tone: "warn", title: "Ajusta tu posición", text: "Todavía no puedo medirte con seguridad. Sigue el consejo en pantalla.", action: null };
  if (!visible) return { id: "invisible", tone: "warn", title: "No te veo bien", text: "Aléjate un poco y que se vea toda la extremidad.", action: null };
  if (!calibrated) return { id: "calibrate", tone: "info", title: "Ponte en reposo", text: "Quédate en la posición inicial, con la extremidad relajada, y toca Calibrar.", action: "calibrate" };
  if (prog?.complete) return { id: "done", tone: "done", title: "¡Terminaste tus series!", text: "Buen trabajo. Guarda la sesión para ver tu resultado.", action: "save" };
  if (reps > 0 && prog.repInSet === 0) return { id: "rest", tone: "rest", title: `Serie ${prog.set - 1} lista. Descansa`, text: `Respira. Cuando quieras, empieza la serie ${prog.set} de ${prog.sets}.`, action: reps > 0 ? "save" : null };
  if (reps === 0) return { id: "go", tone: "go", title: "¡Ya! Empieza", text: "Mueve despacio hasta la meta y vuelve. Yo cuento por ti.", action: null };
  return { id: "doing", tone: "go", title: `Llevas ${prog.repInSet} de esta serie`, text: "Sigue así: lento y controlado.", action: reps > 0 ? "save" : null };
}

// Fracción (0–1) del camino hacia la meta, para el termómetro de la pantalla. `null` si no hay lectura.
export function goalFraction(flexion, targetFlexion) {
  if (flexion == null || !(targetFlexion > 0)) return null;
  return Math.max(0, Math.min(1, flexion / targetFlexion));
}
