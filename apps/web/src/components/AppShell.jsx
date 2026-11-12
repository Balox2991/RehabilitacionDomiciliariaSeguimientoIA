import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { homeFor, useAuth } from "../lib/auth.jsx";
import Brand from "./Brand.jsx";

export default function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const inApp = status === "in" && !user.must_change_password;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="container topbar-in">
          <Brand to={inApp ? homeFor(user) : "/"} />
          <nav className="topnav" aria-label="Principal">
            {status === "in" && (
              <>
                <span className="topnav-user" title={user.email}>{user.name}</span>
                {inApp && <Link to="/cambiar-clave" className="btn btn-ghost btn-sm">Contraseña</Link>}
                <button type="button" className="btn btn-ghost btn-sm topnav-switch" onClick={async () => { await logout(); navigate("/", { replace: true }); }}>Cerrar sesión</button>
              </>
            )}
            {status === "out" && pathname !== "/" && <Link to="/" className="btn btn-ghost btn-sm topnav-switch">Ir al ingreso</Link>}
          </nav>
        </div>
      </header>
      <main id="contenido">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-in">
          <Brand compact />
          <p>Proyecto de grado · Ingeniería de Sistemas. No es un dispositivo médico.</p>
        </div>
      </footer>
    </div>
  );
}
