import { Link } from "react-router-dom";

// Indicador: qué es, su número y cómo leerlo. Lo usan el resumen del fisioterapeuta y el progreso del paciente.
// Con `to`, todo el indicador es un enlace (p. ej. «Alertas» lleva a la lista ya filtrada).
export default function Kpi({ label, value, unit, hint, to }) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value num">{value ?? "—"}{unit && value != null && <small>{unit}</small>}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </>
  );
  return to ? <Link to={to} className="kpi kpi-link">{body}</Link> : <div className="kpi">{body}</div>;
}
