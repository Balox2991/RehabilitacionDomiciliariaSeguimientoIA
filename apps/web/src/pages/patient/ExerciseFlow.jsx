import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import { VIEW_ADVICE_TEXT, bodyPartOf, exerciseOf, setupTips } from "../../lib/exercise.js";
import { saveSessionSafely } from "../../lib/saveSession.js";
import { useAsync } from "../../lib/useAsync.js";
import { deg, sideLabel } from "../../lib/format.js";
import { newAchievements, nextStep, setProgress } from "../../lib/patientHome.js";
import { buildSessionPayload } from "../../lib/sessionPayload.js";
import { flexionFromAngle } from "../../lib/rom.js";
import { ErrorState, Loading } from "../../components/PageState.jsx";
import DemoPanel from "../../components/DemoPanel.jsx";
import Icon from "../../components/Icon.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import CoachCard from "../../components/CoachCard.jsx";
import InsightList from "../../components/InsightList.jsx";
import PatientPage from "../../components/PatientPage.jsx";
import RepBars from "../../components/RepBars.jsx";
import VideoUpload from "../../components/VideoUpload.jsx";
import { assessReliability } from "@engine/reliability.js";
import { sessionQualityNote } from "../../lib/quality.js";
import { coachPrompt, goalFraction } from "../../lib/coachPrompt.js";
import { useTracking } from "../../tracking/useTracking.js";

const STEPS = [
  { id: "ver", label: "Mira cómo se hace" },
  { id: "practicar", label: "Haz tu serie" },
  { id: "listo", label: "Listo" },
];

function Stepper({ current }) {
  const at = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="stepper" aria-label={`Paso ${at + 1} de ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li key={s.id} className={i < at ? "is-done" : i === at ? "is-current" : ""} aria-current={i === at ? "step" : undefined}>
          <span className="stepper-n" aria-hidden="true">{i < at ? <Icon name="check" size={14} /> : i + 1}</span>
          <span className="stepper-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

// Aviso permanente mientras se practica: la app cuenta repeticiones, no siente dolor.
function SafetyStrip() {
  return (
    <p className="safety-strip" role="note">
      <Icon name="alert" size={18} />
      <span>Si sientes dolor agudo, mareo u hormigueo, <strong>detente y avisa a tu fisioterapeuta</strong>.</span>
    </p>
  );
}

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Cada ejercicio es un flujo nuevo: con `key`, pasar de un ejercicio al siguiente reinicia el paso y la sesión guardada
// (sin esto, «Siguiente: …» mostraría todavía la pantalla «Listo» del ejercicio anterior).
export default function ExerciseFlow() {
  const { planId } = useParams();
  return <Flow key={planId} />;
}

// Flujo guiado de un ejercicio del plan: primero se ve la demostración, después se practica con la cámara.
function Flow() {
  const { pid, planId } = useParams();
  const [params] = useSearchParams();
  const { data, error, loading, reload } = useAsync(async () => {
    const overview = await api.patientOverview(pid);
    const plan = overview.plans.find((p) => String(p.plan_id) === planId) ?? null;
    const item = plan?.library_code ? await api.libraryItem(plan.library_code) : null;
    return { overview, plan, item };
  }, [pid, planId]);
  const [step, setStep] = useState(params.get("directo") ? "practicar" : "ver");
  const [saved, setSaved] = useState(null);

  if (loading) return <Loading rows={2} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { overview, plan, item } = data;
  if (!plan) {
    return (
      <PatientPage>
        <div className="notice notice-info">Este plan no existe o ya no está activo. <Link to={`/paciente/${pid}`}>Volver a mi recuperación</Link></div>
      </PatientPage>
    );
  }
  const current = saved ? "listo" : step === "subir" ? "practicar" : step;

  return (
    <PatientPage>
      <PageHeader
        back={{ to: `/paciente/${pid}`, label: "Volver a mi recuperación" }}
        title={plan.exercise_name}
        description={`${cap(sideLabel(plan.side))} · meta de ${deg(plan.target_flexion)} de flexión · ${plan.sets} ${plan.sets === 1 ? "serie" : "series"} de ${plan.reps_per_set}`}
      />
      <Stepper current={current} />

      {current === "ver" && (
        <>
          <section className="stack-tight" aria-labelledby="h-ver">
            <h2 className="section-h" id="h-ver">Antes de empezar, mira cómo se hace</h2>
            {item ? <DemoPanel item={item} target={plan.target_angle} /> : <div className="notice notice-info">Este ejercicio aún no tiene ficha en la biblioteca.</div>}
          </section>
          <section className="card panel prep" aria-labelledby="h-prep">
            <div className="panel-head"><h2 id="h-prep">Prepara tu espacio</h2></div>
            <ul>{setupTips(exerciseOf(plan)).map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>
          <div className="flow-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setStep("practicar")}>Ya lo vi, practicar con la cámara</button>
            <button className="btn btn-ghost btn-lg" onClick={() => setStep("subir")}>Tengo un video grabado</button>
            <Link to={`/paciente/${pid}`} className="btn btn-quiet">Ahora no</Link>
          </div>
        </>
      )}

      {step === "subir" && !saved && <VideoUpload pid={pid} plan={plan} exercise={exerciseOf(plan)} onSaved={setSaved} onBack={() => setStep("ver")} />}
      {current === "practicar" && step !== "subir" && <Practice pid={pid} plan={plan} item={item} onSaved={setSaved} onBack={() => setStep("ver")} debug={params.get("debug") === "1"} />}
      {current === "listo" && <Done pid={pid} overview={overview} plan={plan} session={saved} />}
    </PatientPage>
  );
}

// Herramienta técnica (solo con ?debug=1): descarga la serie de ángulos de la sesión, junto con las repeticiones que la
// persona contó a mano, para comparar con las que contó la aplicación. Son solo números: no incluye video ni imágenes.
function TraceTools({ t }) {
  const [manual, setManual] = useState("");
  function download() {
    const trace = t.exportTrace(manual === "" ? null : Number(manual));
    const url = URL.createObjectURL(new Blob([JSON.stringify(trace)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sesion-${trace.meta.exercise}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="card panel trace-tools" aria-label="Herramientas técnicas">
      <div className="panel-head"><h2>Registro técnico</h2><p>Modelo: {t.model ?? "—"} · Cuenta la aplicación: {t.reps}</p></div>
      <label className="trace-field">Repeticiones que hiciste de verdad
        <input type="number" min="0" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} />
      </label>
      <button type="button" className="btn btn-ghost" onClick={download}>Descargar registro (JSON)</button>
    </section>
  );
}

function Practice({ pid, plan, item, onSaved, onBack, debug }) {
  const exercise = useMemo(() => exerciseOf(plan), [plan]);
  const t = useTracking({ exercise, side: plan.side, targetAngle: plan.target_angle });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [count, setCount] = useState(null); // cuenta regresiva 3-2-1 antes de calibrar (null = no está contando)

  const prog = setProgress(t.reps, plan.sets, plan.reps_per_set);
  const flex = t.angle == null ? null : flexionFromAngle(exercise.direction, t.angle);
  const running = t.phase === "running";
  const q = t.quality;
  const hidden = running && q.mode === "hidden"; // medición no fiable: sin ángulos ni repeticiones, con consejo y guía
  const approx = running && q.mode === "approx";
  const frac = hidden ? null : goalFraction(flex, plan.target_flexion);
  const prompt = coachPrompt({
    phase: t.phase, running, calibrated: t.calibrated, counting: count != null, hidden, visible: t.visible,
    reps: t.reps, prog: { ...prog, sets: plan.sets }, saving,
  });

  // Cuenta regresiva: la persona se coloca en reposo y la app calibra sola al llegar a 0.
  useEffect(() => {
    if (count == null) return undefined;
    if (count === 0) { t.calibrate(); setCount(null); return undefined; }
    const id = setTimeout(() => setCount((c) => (c == null ? c : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [count, t.calibrate]);
  useEffect(() => { if (!running) setCount(null); }, [running]);

  async function finish() {
    const snap = t.snapshot();
    setSaving(true);
    setSaveError("");
    try {
      // El dato guardado sale del análisis posterior del registro completo; si algo falla se conserva el conteo en vivo.
      const { body } = buildSessionPayload({ plan, snap, trace: t.buildTrace() });
      const session = await saveSessionSafely(pid, body); // si el servidor rechaza el registro, la sesión se guarda sin él
      const quality = snap && t.buildTrace() ? assessReliability(t.buildTrace(), exercise) : null;
      t.stop();
      onSaved({ ...session, _quality: quality });
    } catch (err) {
      setSaveError(err.message); // la sesión sigue en pantalla: se puede reintentar sin perder las repeticiones
    } finally {
      setSaving(false);
    }
  }

  const act = { start: t.start, calibrate: () => setCount(3), save: finish }[prompt.action];
  const actLabel = { start: "Encender cámara", calibrate: "Calibrar (3-2-1)", save: saving ? "Guardando…" : "Terminar y guardar" }[prompt.action];

  return (
    <div className="ex-grid">
      <div className="ex-left">
        <section className={`coach-bar is-${prompt.tone}`} aria-live="polite" aria-label="Qué hacer ahora">
          <div className="coach-bar-text">
            <strong>{prompt.title}</strong>
            <span>{prompt.text}</span>
          </div>
          {act && <button className="btn btn-primary btn-lg" onClick={act} disabled={saving}>{actLabel}</button>}
        </section>

        <section className="stage card" aria-label="Cámara">
          <div className="stage-frame">
            {/* El video se procesa pero NO se muestra: el paciente ve solo su esqueleto (privacidad y menos distracción). */}
            <video ref={t.videoRef} className="stage-video" playsInline muted aria-hidden="true" />
            <canvas ref={t.canvasRef} className="stage-canvas" />
            {!running && (
              <div className="stage-idle">
                <p>{t.phase === "loading" ? t.message : "La cámara está apagada"}</p>
                {t.phase !== "loading" && <p className="stage-privacy">Tu imagen nunca se muestra ni se guarda: en pantalla solo verás tu esqueleto.</p>}
                {t.phase === "error" && <p className="stage-error" role="alert">{t.message}</p>}
              </div>
            )}
            {running && !hidden && (
              <>
                <div className="stage-hud" aria-live="off">
                  <span className="hud-label">Flexión</span>
                  <strong className="num">{flex == null ? "—" : `${approx ? "≈ " : ""}${Math.round(flex)}°`}</strong>
                  <small className="num">ángulo articular {t.angle == null ? "—" : `${t.angle.toFixed(0)}°`}</small>
                </div>
                <div className="stage-reps" aria-live="off">
                  <span className="hud-label">Repeticiones</span>
                  <strong className="num" key={t.reps}><span className="pop">{t.reps}</span><small> / {prog.total}</small></strong>
                </div>
                {t.calibrated && frac != null && (
                  <div className={`goal-gauge ${frac >= 1 ? "is-hit" : ""}`} role="img" aria-label={`${Math.round(frac * 100)}% del camino a tu meta`}>
                    <span className="goal-gauge-top">Meta {Math.round(plan.target_flexion)}°</span>
                    <div className="goal-gauge-track"><i style={{ height: `${frac * 100}%` }} /></div>
                  </div>
                )}
              </>
            )}
            {count != null && count > 0 && <div className="stage-count" aria-hidden="true"><span key={count}>{count}</span></div>}
            {hidden && (
              <div className="stage-quality" role="status">
                <strong>{q.headline}</strong>
                <ul>{q.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                <small>No te muestro ángulos ni cuento repeticiones hasta que la imagen sea clara.</small>
              </div>
            )}
            {running && !t.visible && <div className="stage-alert stage-alert-view" role="status">No veo bien tu {bodyPartOf(exercise)}. Aléjate un poco y que se vea toda la extremidad.</div>}
            {running && t.visible && t.viewAdvice && <div className="stage-alert stage-alert-view" role="status">{VIEW_ADVICE_TEXT[t.viewAdvice]}</div>}
            {approx && t.visible && !t.viewAdvice && q.tips[0] && <div className="stage-alert stage-alert-view" role="status">{q.tips[0]}</div>}
            {running && t.visible && !t.viewAdvice && !approx && t.flags.length > 0 && <div className="stage-alert" role="status">Posible compensación: {t.flags.join(", ")}</div>}
          </div>
          <div className="stage-actions">
            {running && t.calibrated && <button className="btn btn-ghost" onClick={() => setCount(3)}>Recalibrar reposo</button>}
            {running && <button className="btn btn-ghost" onClick={t.stop}>Apagar cámara</button>}
            <button className="btn btn-quiet" onClick={onBack}>Ver la demostración otra vez</button>
          </div>
        </section>
        <SafetyStrip />
        {debug && <TraceTools t={t} />}
      </div>

      <aside className="ex-side">
        <section className="card panel session" aria-label="Tu sesión">
          <span className="kpi-label">Serie {Math.min(prog.set, plan.sets)} de {plan.sets}</span>
          <p className="session-count num">
            {prog.complete ? "¡Completaste todas tus series!" : `Llevas ${prog.repInSet} de ${plan.reps_per_set} en esta serie`}
          </p>
          <div className="set-dots" aria-hidden="true">
            {Array.from({ length: plan.reps_per_set }, (_, i) => <i key={i} className={i < prog.repInSet || prog.complete ? "on" : ""} />)}
          </div>
          <div className="meter" role="img" aria-label={`${t.reps} de ${prog.total} repeticiones`}><span style={{ width: `${Math.min(100, (t.reps / prog.total) * 100)}%` }} /></div>
          <span className={`pill ${t.inTarget ? "pill-ok" : "pill-mute"}`}>{t.inTarget ? "En rango objetivo" : "En reposo"}</span>
          {saveError && <p className="notice notice-error" role="alert">No se pudo guardar: {saveError}. Tus repeticiones siguen aquí; intenta de nuevo.</p>}
          {t.reps >= 1 && !prog.complete && (
            <button className="btn btn-ghost btn-block" onClick={finish} disabled={saving}>{saving ? "Guardando…" : "Terminar antes y guardar"}</button>
          )}
        </section>

        {hidden && item && (
          <section className="card panel guide-compare" aria-label="Compara tu postura">
            <div className="panel-head"><h2>Compara con el muñeco</h2><p>Ponte como él y que se vea todo tu cuerpo.</p></div>
            <DemoPanel item={item} target={plan.target_angle} showSteps={false} />
          </section>
        )}

        {item && (
          <details className="peek card panel">
            <summary>Recordatorio de los pasos y precauciones</summary>
            <ol className="steps-list">{item.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <ul className="cautions-inline">{item.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </details>
        )}
      </aside>
    </div>
  );
}

// Lo que el paciente ve de su análisis: una barra por repetición y hasta dos observaciones en lenguaje llano.
function SessionResult({ session, plan }) {
  const a = session.analysis;
  const targetFlexion = session.direction === "decreasing" ? 180 - plan.target_angle : plan.target_angle;
  if (a.summary.count === 0) return <InsightList suggestions={a.suggestions} audience="patient" limit={2} />;
  return (
    <section className="done-result" aria-label="Tu sesión en detalle">
      <h3>Tu sesión repetición por repetición</h3>
      <RepBars analysis={a} targetFlexion={targetFlexion} />
      <InsightList suggestions={a.suggestions} audience="patient" limit={2} />
    </section>
  );
}

// «Para tu próxima sesión»: recomendaciones del asistente con el análisis del video que acaba de hacer y su historial.
function SessionCoach({ pid, plan, session }) {
  const { data } = useAsync(() => api.coach(pid, { session: session.id }), [pid, session.id]);
  const mine = data?.plans.find((p) => p.plan_id === plan.plan_id);
  if (!mine) return null; // si el asistente falla o no tiene nada que decir, la pantalla de resultado queda igual
  return <CoachCard plan={mine} evidence={data.evidence} pid={pid} libraryCode={mine.library_code} title="Tu asistente: para la próxima sesión" />;
}

function Done({ pid, overview, plan, session }) {
  const { patient, plans } = overview;
  const following = nextStep(plans, plan.plan_id); // el ejercicio que más le falta, sin contar el que acaba de hacer
  const unlocked = newAchievements(overview, plan.plan_id, session);
  const qualityNote = sessionQualityNote(session._quality);
  const noAngles = session._quality?.verdict === "unreliable"; // no se muestran ángulos que no podemos respaldar
  return (
    <>
      <section className="card panel done-card" aria-labelledby="h-done">
        <span className="done-check" aria-hidden="true"><Icon name="check" size={30} /></span>
        <p className="eyebrow">Sesión guardada</p>
        <h2 id="h-done">¡Buen trabajo, {patient.name.split(" ")[0]}!</h2>
        <div className="done-stats">
          <div><strong className="num">{session.reps_completed}</strong><span>repeticiones</span></div>
          <div><strong className="num">{noAngles ? "—" : deg(session.flexion)}</strong><span>mejor flexión (meta {deg(plan.target_flexion)})</span></div>
          <div><strong className="num">{session.compensation_count}</strong><span>con postura por revisar</span></div>
        </div>
        {qualityNote && <p className="notice notice-info" role="status">{qualityNote}</p>}
        {session.analysis && !noAngles && <SessionResult session={session} plan={plan} />}
        {unlocked.length > 0 && (
          <div className="done-ach" role="status">
            <strong>{unlocked.length === 1 ? "¡Nuevo logro!" : "¡Nuevos logros!"}</strong>
            <ul>{unlocked.map((a) => <li key={a.id}><span aria-hidden="true"><Icon name={a.icon} size={16} /></span>{a.title}</li>)}</ul>
          </div>
        )}
        {session.compensation_count > 0 && <p className="done-tip">Algunas repeticiones tuvieron la postura por revisar. La próxima vez ve más despacio y mantén el tronco quieto.</p>}
        <div className="flow-actions">
          {following && <Link to={`/paciente/${pid}/ejercicio/${following.plan_id}`} className="btn btn-primary btn-lg">Siguiente: {following.exercise_name}</Link>}
          <Link to={`/paciente/${pid}`} className={`btn ${following ? "btn-ghost" : "btn-primary"} btn-lg`}>Ver mi recuperación</Link>
          <Link to={`/paciente/${pid}/progreso`} className="link-arrow">Ver mi progreso <Icon name="arrow" size={16} /></Link>
        </div>
      </section>
      {session.analysis && <SessionCoach pid={pid} plan={plan} session={session} />}
    </>
  );
}
