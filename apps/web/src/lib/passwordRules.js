// Reglas de contraseña (las mismas del servidor, que es quien decide de verdad). Sirve para avisar mientras se escribe.
export function passwordProblem(password, email = "") {
  if (typeof password !== "string" || password.length === 0) return "Escribe una contraseña.";
  if (password.length < 10) return "Debe tener al menos 10 caracteres.";
  if (password.length > 200) return "Es demasiado larga (máximo 200).";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Debe mezclar letras y números.";
  const local = String(email).split("@")[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return "No debe contener tu correo.";
  return null;
}

// Contraseña inicial legible para entregar a un paciente (sin caracteres que se confunden: 0/O, 1/l/I).
export function suggestPassword(randomValues = (n) => crypto.getRandomValues(new Uint32Array(n))) {
  const letters = "abcdefghjkmnpqrstuvwxyz", digits = "23456789";
  const pick = (set, r) => set[r % set.length];
  const r = randomValues(12);
  let out = "";
  for (let i = 0; i < 8; i++) out += pick(letters, r[i]);
  out += "-" + pick(digits, r[8]) + pick(digits, r[9]) + pick(digits, r[10]) + pick(digits, r[11]);
  return out;
}
