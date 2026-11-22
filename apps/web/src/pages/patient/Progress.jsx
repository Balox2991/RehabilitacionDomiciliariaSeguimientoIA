import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAsync } from "../../lib/useAsync.js";
import { deg, formatDay, formatTime } from "../../lib/format.js";
import { averageProgress, progressMessage } from "../../lib/patientHome.js";
import { ErrorState, Loading } from "../../components/PageState.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Achievements from "../../components/Achievements.jsx";
import Journey from "../../components/Journey.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import PatientPage from "../../components/PatientPage.jsx";
import ProgressRing from "../../components/ProgressRing.jsx";
import { EvolutionCard, StatsRow } from "../../components/ProgressParts.jsx";
import WeekStrip from "../../charts/WeekStrip.jsx";

const PAGE = 4; // sesiones visibles antes de «Ver más»

// Una sesión que se abre al tocarla: muestra cada repetición. Si el detalle no se puede cargar, la fila sigue sirviendo.
function SessionRow({ s }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  async function toggle() {
    setOpen((o) => !o);
    if (!detail) {
      try { setDetail(await api.session(s.id)); } catch { setDetail({ error: true }); }
    }
  }
  const unreliable = detail?.quality?.verdict === "unreliable";
  return (
    <li className={`sess ${open ? "is-open" : ""}`}>
      <button type="button" className="sess-btn" onClick={toggle} aria-expanded={open}>
        <div className="sess-main">
          <strong>{s.exercise_name}</strong>
          <small>{formatDay(s.started_at)} · {formatTime(s.started_at)} · {s.reps_completed} {s.reps_completed === 1 ? "repetición" : "repeticiones"}</small>
          {s.compensation_count > 0 && <span className="pill pill-warn">{s.compensation_count} con postura por revisar</span>}
        </div>
        <span className="sess-flex num" title="Mejor flexión de la sesión">{deg(s.flexion)}</span>
        <span className="sess-chev" aria-hidden="true">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="sess-detail">
          {!detail && <span className="cell-mute">Cargando…</span>}
          {detail?.error && <span className="cell-mute">No se pudo cargar el detalle.</span>}
          {unreliable && <p className="notice notice-info">La cámara no midió con seguridad esta sesión, así que sus ángulos son orientativos.</p>}
          {detail?.reps && !unreliable && (
            <ol className="rep-chips">
              {detail.reps.map((r) => (
                <li key={r.rep_number} className={r.compensation_flags.length ? "has-flag" : ""} title={r.compensation_flags.join(", ") || "Sin alertas"}>
                  <small>#{r.rep_number}</small><strong className="num">{deg(r.flexion)}</strong>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function RecentSessions({ sessions }) {
  const [all, setAll] = useState(false);
  if (sessions.length === 0) return <p className="card-sub">Todavía no hay sesiones de este ejercicio. Cuando hagas la primera, aparecerá aquí.</p>;
  const shown = all ? sessions : sessions.slice(0, PAGE);
  return (
    <>
      <ul className="sess-list">{shown.map((s) => <SessionRow key={s.id} s={s} />)}</ul>
      {sessions.length > PAGE && <button type="button" className="btn btn-quiet" onClick={() => setAll((v) => !v)}>{all ? "Ver menos" : `Ver las ${sessions.length} sesiones`}</button>}
    </>
  );
}

export default function Progress() {
  const { pid } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.patientOverview(pid), [pid]);
  const [sel, setSel] = useState("all"); // "all" o el plan_id del ejercicio elegido

  const plans = data?.plans ?? [];
  const chosen = useMemo(() => (sel === "all" ? plans : plans.filter((p) => String(p.plan_id) === String(sel))), [plans, sel]);
  const names = useMemo(() => new Set(chosen.map((p) => p.exercise_name)), [chosen]);

  if (loading) return <Loading rows={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { last_7_days: days, recent_sessions: recent } = data;
  const avg = averageProgress(chosen);
  const sessions = recent.filter((s) => sel === "all" || names.has(s.exercise_name));

  return (
    <PatientPage>
      <PageHeader title="Mi progreso" description="Toca un ejercicio para ver solo su avance, y toca una sesión para ver cada repetición." />

      {plans.length > 1 && (
        <div className="chips prog-filter" role="tablist" aria-label="Ejercicio">
          <button role="tab" aria-selected={sel === "all"} className={`chip ${sel === "all" ? "is-on" : ""}`} onClick={() => setSel("all")}>Todos</button>
          {plans.map((p) => (
            <button key={p.plan_id} role="tab" aria-selected={String(sel) === String(p.plan_id)} className={`chip ${String(sel) === String(p.plan_id) ? "is-on" : ""}`} onClick={() => setSel(p.plan_id)}>{p.exercise_name}</button>
          ))}
        </div>
      )}

      {plans.length === 0 ? (
        <section className="card panel">
          <EmptyState icon="chart" title="Aún no hay un plan para medir">Cuando tu fisioterapeuta te asigne ejercicios, aquí verás tu recorrido hacia la meta.</EmptyState>
        </section>
      ) : (
        <section className="card panel prog-hero" aria-labelledby="h-recorrido" key={sel}>
          <div className="prog-ring">
            <ProgressRing value={avg} size={136} stroke={12} label="de tu meta" />
            <p>{progressMessage(avg)}</p>
          </div>
          <div className="prog-journeys">
            <h2 id="h-recorrido" className="prog-title">{sel === "all" ? "Tu recorrido" : chosen[0].exercise_name}</h2>
            {chosen.map((p) => <Journey key={p.plan_id} plan={p} />)}
          </div>
        </section>
      )}

      <StatsRow data={data} />

      <div className="prog-grid">
        <div className="prog-col">
          <EvolutionCard plans={chosen} key={`evo-${sel}`} />
          <section className="card panel" aria-labelledby="h-7d">
            <div className="panel-head"><h2 id="h-7d">Últimos 7 días</h2><p>Un círculo lleno es un día en el que hiciste al menos una sesión.</p></div>
            <WeekStrip days={days} />
          </section>
        </div>
        <section className="card panel" aria-labelledby="h-rec">
          <div className="panel-head"><h2 id="h-rec">Sesiones recientes</h2></div>
          <RecentSessions sessions={sessions} key={`rs-${sel}`} />
        </section>
      </div>

      <details className="more-card card">
        <summary>Tus logros</summary>
        <Achievements data={data} />
      </details>
    </PatientPage>
  );
}
