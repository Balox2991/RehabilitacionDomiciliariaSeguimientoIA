import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { homeFor, useAuth } from "../lib/auth.jsx";
import { passwordProblem } from "../lib/passwordRules.js";
import Field from "../components/Field.jsx";

// Pantalla obligatoria la primera vez (la contraseña inicial la conoce quien creó la cuenta) y cuando alguien la restablece.
export default function ChangePassword() {
  const { status, user, passwordChanged } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", password: "", again: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (status === "out") return <Navigate to="/" replace />;
  if (status !== "in") return null;

  async function submit(e) {
    e.preventDefault();
    const problem = passwordProblem(form.password, user.email) ?? (form.password !== form.again ? "Las dos contraseñas nuevas no coinciden." : null);
    if (problem) return setError(problem);
    setSaving(true);
    setError("");
    try {
      await api.changePassword(form.current, form.password);
      passwordChanged();
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="container page-pad">
      <form className="card panel form-panel" onSubmit={submit} style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="panel-head">
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{user.must_change_password ? "Elige tu contraseña" : "Cambiar contraseña"}</h1>
            <p>{user.must_change_password ? "La contraseña que te entregaron es temporal. Elige una que solo tú conozcas para continuar." : "Al cambiarla se cierran tus otras sesiones abiertas."}</p>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Contraseña actual"><input type="password" required autoComplete="current-password" value={form.current} onChange={set("current")} /></Field>
          <Field label="Contraseña nueva" hint="Mínimo 10 caracteres, con letras y números."><input type="password" required autoComplete="new-password" value={form.password} onChange={set("password")} /></Field>
          <Field label="Repite la contraseña nueva"><input type="password" required autoComplete="new-password" value={form.again} onChange={set("again")} /></Field>
        </div>
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        <div className="form-footer"><div className="form-footer-buttons">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</button>
          {!user.must_change_password && <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>Cancelar</button>}
        </div></div>
      </form>
    </div>
  );
}
