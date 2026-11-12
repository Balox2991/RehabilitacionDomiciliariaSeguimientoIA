// Política de acceso: UN solo lugar que decide quién puede llamar a qué ruta (y sobre qué paciente).
// Función pura sobre (usuario, método, ruta) + consultas de pertenencia. Devuelve null si pasa, o { status, error }.
//
// Reglas (docs/ARQUITECTURA.md §6):
//  · Paciente: solo SUS datos; puede leer su información y guardar sus sesiones. No edita ficha, planes, notas ni consentimiento.
//  · Fisioterapeuta: solo SUS pacientes (los que tienen therapist_id = su id).
//  · Administrador (fisioterapeuta con is_admin): gestiona cuentas de fisioterapeutas; NO ve la clínica de pacientes ajenos.
// Cuando alguien intenta tocar algo que no es suyo se responde 404 (no 403): no se confirma que el recurso exista.

const FORBIDDEN = { status: 403, error: "no tienes permiso para esta acción" };
const NOT_FOUND = { status: 404, error: "no encontrado" };

const PUBLIC = [
  ["GET", /^\/health$/],
  ["GET", /^\/auth\/setup-status$/],
  ["POST", /^\/auth\/setup$/],
  ["POST", /^\/auth\/login$/],
];
export const isPublic = (method, path) => PUBLIC.some(([m, re]) => m === method && re.test(path));

// Lo que un PACIENTE puede hacer sobre sí mismo (lo demás de /patients/:id/* es solo del fisioterapeuta).
const PATIENT_ALLOWED = [
  ["GET", /^\/patients\/\d+$/],
  ["GET", /^\/patients\/\d+\/(photo|plans|sessions|rom-history|report|coach|overview)$/],
  ["POST", /^\/patients\/\d+\/sessions$/],
];

export function authorize(db, user, method, path, body = {}) {
  const owns = (patientId) => {
    if (!Number.isInteger(patientId) || patientId < 1) return false;
    if (user.role === "patient") return user.id === patientId;
    return Boolean(db.prepare("SELECT 1 FROM patient_profiles WHERE user_id = ? AND therapist_id = ?").get(patientId, user.id));
  };
  const therapistOnly = () => (user.role === "therapist" ? null : FORBIDDEN);
  const m = (re) => path.match(re);

  if (user.must_change_password && !(method === "POST" && path === "/auth/password") && !/^\/auth\//.test(path)) {
    return { status: 403, error: "debes cambiar tu contraseña antes de continuar", code: "must_change_password" };
  }

  // Cuentas
  if (/^\/auth\//.test(path)) return null; // /auth/me, /auth/logout, /auth/password: cualquier sesión válida
  if (/^\/admin\//.test(path)) return user.is_admin ? null : FORBIDDEN;
  if (method === "GET" && path === "/therapists") return user.is_admin ? null : FORBIDDEN;

  if (method === "POST" && path === "/users") {
    if (user.role !== "therapist") return FORBIDDEN;
    if (body?.role === "therapist" && !user.is_admin) return FORBIDDEN; // crear fisioterapeutas es del administrador
    return null;
  }

  // Contenido común (solo lectura para todos; editar es del fisioterapeuta)
  if (method === "GET" && /^\/(exercises|library|routines|evidence)(\/|$)/.test(path)) return null;
  if (method === "PATCH" && /^\/library\/[^/]+$/.test(path)) return therapistOnly();

  // Servicio de pose: cualquier sesión válida (paciente y fisioterapeuta suben videos)
  if (/^\/pose\//.test(path)) return null;

  let r;
  if ((r = m(/^\/therapists\/(\d+)(\/|$)/))) {
    return user.role === "therapist" && user.id === Number(r[1]) ? null : NOT_FOUND;
  }

  if ((r = m(/^\/patients\/(\d+)(\/|$)/))) {
    const id = Number(r[1]);
    if (!owns(id)) return NOT_FOUND;
    if (user.role === "patient") return PATIENT_ALLOWED.some(([mm, re]) => mm === method && re.test(path)) ? null : FORBIDDEN;
    // Reasignar un paciente a otro fisioterapeuta lo hace solo el administrador (si no, un fisio podría "regalar" y perder el acceso)
    if (method === "PATCH" && path === `/patients/${id}` && body && "therapist_id" in body && body.therapist_id !== user.id && !user.is_admin) return FORBIDDEN;
    return null;
  }

  if ((r = m(/^\/sessions\/(\d+)(\/trace)?$/))) {
    const row = db.prepare("SELECT patient_id FROM sessions WHERE id = ?").get(Number(r[1]));
    if (!row || !owns(row.patient_id)) return NOT_FOUND;
    return method === "GET" ? null : therapistOnly(); // rehacer el análisis lo pide el fisioterapeuta
  }

  if ((r = m(/^\/plans\/(\d+)$/))) {
    const row = db.prepare("SELECT patient_id FROM exercise_plans WHERE id = ?").get(Number(r[1]));
    if (!row || !owns(row.patient_id)) return NOT_FOUND;
    return therapistOnly();
  }

  return FORBIDDEN; // lo que no está en la política, está prohibido
}

// Qué se anota en la auditoría: todo cambio y la lectura de datos clínicos sensibles de un paciente.
export function auditable(method, path) {
  if (method !== "GET") return /^\/(patients|sessions|plans|users|admin|auth\/password)/.test(path);
  return /^\/patients\/\d+(\/(notes|photo|report))?$/.test(path) || /^\/sessions\/\d+\/trace$/.test(path);
}
