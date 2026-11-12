import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { api } from "./api.js";
import { Loading } from "../components/PageState.jsx";

// Quién está dentro. La sesión vive en una cookie HttpOnly que el servidor entrega al ingresar: JavaScript no la ve.
// Aquí solo se guarda QUIÉN es (para decidir qué pantallas mostrar); lo que puede ver lo decide siempre el servidor.
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const homeFor = (user) => (user.role === "therapist" ? `/fisio/${user.id}` : `/paciente/${user.id}`);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", user: null });

  useEffect(() => {
    let live = true;
    api.me().then(
      ({ user }) => live && setState({ status: "in", user }),
      () => live && setState({ status: "out", user: null })
    );
    return () => { live = false; };
  }, []);

  // El servidor respondió 401 en medio de la sesión (venció o se cerró en otro lugar).
  useEffect(() => {
    const expired = () => setState((s) => (s.status === "in" ? { status: "out", user: null, expired: true } : s));
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await api.login(email, password);
    setState({ status: "in", user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* aunque falle la red, se sale de la pantalla */ }
    setState({ status: "out", user: null });
  }, []);

  const passwordChanged = useCallback(() => setState((s) => (s.user ? { ...s, user: { ...s.user, must_change_password: false } } : s)), []);

  const value = useMemo(() => ({ ...state, login, logout, passwordChanged }), [state, login, logout, passwordChanged]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Guardia de rutas: sin sesión → ingreso; contraseña inicial → cambiarla; rol o dueño equivocado → su propio inicio.
export function RequireAuth({ role, children }) {
  const auth = useAuth();
  const location = useLocation();
  const { tid, pid } = useParams();
  if (auth.status === "loading") return <Loading rows={2} />;
  if (auth.status === "out") return <Navigate to="/" replace state={{ from: location.pathname, expired: auth.expired }} />;
  const { user } = auth;
  if (user.must_change_password) return <Navigate to="/cambiar-clave" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  if (role === "therapist" && tid && Number(tid) !== user.id) return <Navigate to={homeFor(user)} replace />;
  if (role === "patient" && pid && Number(pid) !== user.id) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  return user?.is_admin ? children : <Navigate to={user ? homeFor(user) : "/"} replace />;
}
