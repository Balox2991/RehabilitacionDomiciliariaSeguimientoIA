import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadReviewed, saveReviewed, taskFilters, visibleTasks } from "../../lib/triage.js";
import { api } from "../../lib/api.js";
import { useAsync } from "../../lib/useAsync.js";
import { alertReason, greeting, needsAction, shortName, statusHeadline, suggestedAction } from "../../lib/format.js";
import { ErrorState, Loading } from "../../components/PageState.jsx";
import Avatar from "../../components/Avatar.jsx";
import ContactActions from "../../components/ContactActions.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Icon from "../../components/Icon.jsx";
import Kpi from "../../components/Kpi.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import StatusPill from "../../components/StatusPill.jsx";
import WeeklyBars from "../../charts/WeeklyBars.jsx";
import HBars from "../../charts/HBars.jsx";

const todayText = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

// Una tarea pendiente: quién, por qué, qué hacer y los botones para hacerlo, todo visible.
function TaskItem({ p, tid, from, done = false, onToggle }) {
  return (
    <li className={`task ${done ? "is-done" : ""}`}>
      <div className="task-who">
        <Avatar patient={p} size="md" />
        <div className="task-text">
          <Link to={`/fisio/${tid}/paciente/${p.id}`} className="task-name">{p.name}</Link>
          <span className="task-reason">{alertReason(p) || statusHeadline(p.status)}</span>
          <span className="task-action"><Icon name="arrow" size={13} /> {suggestedAction(p.status)}</span>
        </div>
      </div>
      <StatusPill status={p.status} />
      <div className="task-buttons">
        <Link to={`/fisio/${tid}/paciente/${p.id}`} className="btn btn-primary btn-sm" aria-label={`Ver paciente ${p.name}`}>Ver paciente</Link>
        <ContactActions phone={p.phone} name={p.name} from={from} compact />
        {onToggle && <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle} aria-pressed={done}>{done ? "Deshacer" : "Marcar revisado"}</button>}
      </div>
    </li>
  );
}

// «Pendientes de hoy» como bandeja de entrada: se filtra por tipo y cada paciente se marca como revisado (con deshacer).
function Pending({ tasks, tid, from }) {
  const [filter, setFilter] = useState("todos");
  const [reviewed, setReviewed] = useState(() => loadReviewed(tid));
  const [showReviewed, setShowReviewed] = useState(false);
  const filters = taskFilters(tasks);
  const active = filters.some((f) => f.id === filter) ? filter : "todos";
  const { shown, reviewedCount } = visibleTasks(tasks, { filter: active, reviewed, showReviewed });

  const mark = (id, on) => {
    const next = on ? [...new Set([...reviewed, id])] : reviewed.filter((x) => x !== id);
    setReviewed(next);
    saveReviewed(tid, next);
  };
  const pendingLeft = visibleTasks(tasks, { reviewed }).shown.length;

  return (
    <section className="card panel" aria-labelledby="h-tareas">
      <div className="panel-head">
        <div>
          <h2 id="h-tareas">Pendientes de hoy</h2>
          <p>{tasks.length === 0 ? "Todo al día" : pendingLeft === 0 ? "Revisaste todos los pendientes de hoy" : `${pendingLeft} ${pendingLeft === 1 ? "paciente" : "pacientes"} por revisar, el más urgente primero`}</p>
        </div>
        {tasks.length > 0 && <span className="week-count num" aria-hidden="true">{tasks.length - pendingLeft} de {tasks.length} revisados</span>}
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon="check" title="No hay pendientes">Todos tus pacientes van según lo planeado.</EmptyState>
      ) : (
        <>
          {filters.length > 2 && (
            <div className="chips" role="group" aria-label="Filtrar pendientes">
              {filters.map((f) => (
                <button key={f.id} className={`chip ${active === f.id ? "is-on" : ""}`} aria-pressed={active === f.id} onClick={() => setFilter(f.id)}>{f.label} <span className="num">{f.n}</span></button>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <EmptyState icon="check" title="Bandeja vacía">No quedan pendientes en esta vista.</EmptyState>
          ) : (
            <ul className="task-list">
              {shown.map((p) => <TaskItem key={p.id} p={p} tid={tid} from={from} done={reviewed.includes(p.id)} onToggle={() => mark(p.id, !reviewed.includes(p.id))} />)}
            </ul>
          )}
          {reviewedCount > 0 && <button type="button" className="btn btn-quiet" onClick={() => setShowReviewed((v) => !v)}>{showReviewed ? "Ocultar revisados" : `Ver ${reviewedCount} ${reviewedCount === 1 ? "revisado" : "revisados"}`}</button>}
        </>
      )}
    </section>
  );
}

export default function Overview() {
  const { tid } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.therapistSummary(tid), [tid]);
  if (loading) return <Loading rows={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const { kpis, patients, weekly_sessions: weekly, compensation_breakdown: breakdown, therapist } = data;
  const tasks = patients.filter((p) => needsAction(p.status));
  const onTrack = patients.filter((p) => p.status === "al_dia" || p.status === "en_meta").length;

  return (
    <div className="page-inner stack">
      <PageHeader
        title={`${greeting()}, ${shortName(therapist.name)}`}
        description={`${todayText[0].toUpperCase()}${todayText.slice(1)}`}
        actions={
          <>
            <Link to={`/fisio/${tid}/pacientes`} className="btn btn-ghost">Ver pacientes</Link>
            <Link to={`/fisio/${tid}/pacientes?nuevo=1`} className="btn btn-primary"><Icon name="plus" size={18} /> Nuevo paciente</Link>
          </>
        }
      />

      <section className="kpi-grid" aria-label="Indicadores">
        <Kpi label="Pacientes activos" value={kpis.patients} hint={`${onTrack} al día · ${kpis.needing_attention} con alerta`} to={`/fisio/${tid}/pacientes`} />
        <Kpi label="Adherencia semanal" value={kpis.adherence_pct} unit="%" hint="Sesiones hechas frente a las del plan" to={`/fisio/${tid}/pacientes?orden=reciente`} />
        <Kpi label="Progreso promedio" value={kpis.avg_progress_pct} unit="%" hint="Hacia la meta de flexión de cada plan" to={`/fisio/${tid}/pacientes?orden=progreso`} />
        <Kpi label="Alertas de postura" value={kpis.compensation_rate_30d} unit="%" hint="De las repeticiones, últimos 30 días" to={`/fisio/${tid}/pacientes?estado=atencion`} />
      </section>

      <Pending tasks={tasks} tid={tid} from={therapist.name} />


      <div className="two-col">
        <section className="card panel" aria-labelledby="h-semanal">
          <div className="panel-head"><div><h2 id="h-semanal">Sesiones por semana</h2><p>Todos tus pacientes, últimas 8 semanas</p></div></div>
          <WeeklyBars weeks={weekly} height={260} />
        </section>
        <section className="card panel" aria-labelledby="h-comp">
          <div className="panel-head"><div><h2 id="h-comp">Alertas de postura más frecuentes</h2><p>Repeticiones con alerta, últimos 30 días</p></div></div>
          <HBars items={breakdown} emptyText="Sin alertas de postura en 30 días." tone="brand" />
        </section>
      </div>
    </div>
  );
}
