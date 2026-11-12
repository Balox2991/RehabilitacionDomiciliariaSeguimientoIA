import { useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { useAsync } from "../../lib/useAsync.js";
import { passwordProblem, suggestPassword } from "../../lib/passwordRules.js";
import { ErrorState, Loading } from "../../components/PageState.jsx";
import Field from "../../components/Field.jsx";
import PageHeader from "../../components/PageHeader.jsx";

// Solo para el administrador: cuentas de fisioterapeutas.
export default function Accounts() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.adminTherapists(), []);
  const [form, setForm] = useState({ name: "", email: "", password: suggestPassword() });
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <Loading rows={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function create(e) {
    e.preventDefault();
    const problem = passwordProblem(form.password, form.email);
    if (problem) return setMsg({ ok: "", err: problem });
    setBusy(true);
    try {
      await api.adminCreateTherapist(form);
      setMsg({ ok: `Cuenta creada. Entrégale a ${form.name} su correo y esta contraseña temporal: ${form.password} (la cambiará al ingresar).`, err: "" });
      setForm({ name: "", email: "", password: suggestPassword() });
      reload();
    } catch (err) {
      setMsg({ ok: "", err: err.message });
    }
    setBusy(false);
  }

  async function toggle(t) {
    try {
      await api.adminSetActive(t.id, !t.active);
      setMsg({ ok: "Listo.", err: "" });
      reload();
    } catch (err) {
      setMsg({ ok: "", err: err.message });
    }
  }

  async function reset(t) {
    const password = suggestPassword();
    try {
      await api.adminResetPassword(t.id, password);
      setMsg({ ok: `Nueva contraseña temporal para ${t.name}: ${password}`, err: "" });
    } catch (err) {
      setMsg({ ok: "", err: err.message });
    }
  }

  return (
    <div className="page-inner stack">
      <PageHeader title="Cuentas de fisioterapeutas" description="Solo el administrador crea, desactiva o restablece cuentas. Un administrador no ve la información clínica de pacientes ajenos." />
      <section className="card panel">
        <ul className="prow-list">
          {data.map((t) => (
            <li key={t.id} className="prow" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
              <span><strong>{t.name}</strong>{t.is_admin ? " · administrador" : ""}{!t.active ? " · desactivada" : ""}<br /><small>{t.email} · {t.patients} pacientes</small></span>
              {t.id !== user.id && (
                <span style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => reset(t)}>Restablecer contraseña</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggle(t)}>{t.active ? "Desactivar" : "Reactivar"}</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <form className="card panel form-panel" onSubmit={create}>
        <div className="panel-head"><div><h2>Nueva fisioterapeuta</h2><p>Define una contraseña temporal; se le pedirá cambiarla en su primer ingreso.</p></div></div>
        <div className="form-grid">
          <Field label="Nombre completo"><input required value={form.name} onChange={set("name")} autoComplete="off" /></Field>
          <Field label="Correo electrónico"><input required type="email" value={form.email} onChange={set("email")} autoComplete="off" /></Field>
          <Field label="Contraseña temporal"><input required value={form.password} onChange={set("password")} autoComplete="off" /></Field>
        </div>
        {msg.err && <p className="notice notice-error" role="alert">{msg.err}</p>}
        {msg.ok && <p className="notice notice-info" role="status">{msg.ok}</p>}
        <div className="form-footer"><div className="form-footer-buttons"><button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</button></div></div>
      </form>
    </div>
  );
}
