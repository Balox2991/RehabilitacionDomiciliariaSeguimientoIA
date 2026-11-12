import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { homeFor, useAuth } from "../lib/auth.jsx";
import { passwordProblem } from "../lib/passwordRules.js";
import { normalizeEmail, validateLogin } from "../lib/loginForm.js";
import Icon from "../components/Icon.jsx";

const POINTS = [
  { icon: "camera", text: "Mide tus movimientos con la cámara de tu casa" },
  { icon: "shield", text: "Tu video nunca sale de tu dispositivo" },
  { icon: "chart", text: "Tu fisioterapeuta sigue tu evolución" },
];

// Pantalla de ingreso: foto a la izquierda (desvanecida hacia el fondo) y la tarjeta de acceso flotando a la derecha.
export default function Login() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [touched, setTouched] = useState({});
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null); // null = aún no se sabe · { name } = primera vez: crear al administrador
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { api.setupStatus().then((r) => setSetup(r.needs_setup ? { name: "" } : null), () => {}); }, []);
  useEffect(() => { if (location.state?.expired) setNotice("Tu sesión se cerró. Ingresa de nuevo."); }, [location.state]);

  if (auth.status === "in") return <Navigate to={auth.user.must_change_password ? "/cambiar-clave" : homeFor(auth.user)} replace />;

  const errors = validateLogin(values);
  const showError = (field) => touched[field] && errors[field];

  const set = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setNotice("");
  };

  async function submit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length) return;
    const email = normalizeEmail(values.email);
    setBusy(true);
    setNotice("");
    try {
      if (setup) {
        const problem = !setup.name.trim() ? "Escribe tu nombre." : passwordProblem(values.password, email);
        if (problem) throw new Error(problem);
        await api.setup({ name: setup.name.trim(), email, password: values.password });
        setSetup(null);
      }
      const user = await auth.login(email, values.password);
      const back = location.state?.from;
      navigate(user.must_change_password ? "/cambiar-clave" : back?.startsWith(homeFor(user)) ? back : homeFor(user), { replace: true });
    } catch (err) {
      setNotice(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-photo" aria-label="Presentación">
        <div className="auth-photo-img" aria-hidden="true" />
        <div className="auth-photo-mark" aria-hidden="true" />
        <div className="auth-photo-copy">
          <p className="auth-kicker">Programa de rehabilitación domiciliaria</p>
          <h1>Tu recuperación en casa, acompañada de inteligencia artificial</h1>
          <ul className="auth-points">
            {POINTS.map((p) => (
              <li key={p.text}><span aria-hidden="true"><Icon name={p.icon} size={18} /></span>{p.text}</li>
            ))}
          </ul>
        </div>
      </section>

      <main className="auth-side" id="contenido">
        <div className="auth-card">
          <img className="auth-logo" src="/brand/logo-completo.png" alt="Clínica Ocaña · App rehabilitación física" width="180" height="162" />
          <div className="auth-head">
            <h2>{setup ? "Configuración inicial" : "Te damos la bienvenida"}</h2>
            <p>{setup ? "Aún no hay cuentas. Crea la cuenta del administrador de la clínica." : "Ingresa con tu cuenta para continuar con tu rehabilitación."}</p>
          </div>

          <form onSubmit={submit} noValidate className="auth-form">
            {setup && (
              <div className="auth-field">
                <label htmlFor="setup-name">Nombre completo</label>
                <input id="setup-name" autoComplete="name" value={setup.name} onChange={(e) => setSetup({ name: e.target.value })} />
              </div>
            )}
            <div className={`auth-field ${showError("email") ? "has-error" : ""}`}>
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email" type="email" autoComplete="username" inputMode="email" placeholder="nombre@correo.com"
                value={values.email} onChange={set("email")} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                aria-invalid={showError("email") ? "true" : undefined} aria-describedby={showError("email") ? "login-email-err" : undefined}
              />
              {showError("email") && <p className="auth-error" id="login-email-err">{errors.email}</p>}
            </div>

            <div className={`auth-field ${showError("password") ? "has-error" : ""}`}>
              <label htmlFor="login-password">Contraseña</label>
              <div className="auth-password">
                <input
                  id="login-password" type={show ? "text" : "password"} autoComplete={setup ? "new-password" : "current-password"} placeholder={setup ? "Mínimo 10 caracteres, letras y números" : "Tu contraseña"}
                  value={values.password} onChange={set("password")} onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  aria-invalid={showError("password") ? "true" : undefined} aria-describedby={showError("password") ? "login-password-err" : undefined}
                />
                <button type="button" className="auth-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={show}>
                  <Icon name={show ? "eyeoff" : "eye"} size={20} />
                </button>
              </div>
              {showError("password") && <p className="auth-error" id="login-password-err">{errors.password}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block auth-submit" disabled={busy}>{busy ? "Ingresando…" : setup ? "Crear cuenta e ingresar" : "Ingresar"}</button>
            {notice && <p className="notice notice-info" role="alert">{notice}</p>}
          </form>

          <p className="auth-help">¿Aún no tienes cuenta? Tu fisioterapeuta te registra y te entrega tu contraseña inicial.</p>

        </div>
        <p className="auth-foot">Proyecto de grado · Ingeniería de Sistemas. No es un dispositivo médico.</p>
      </main>
    </div>
  );
}
