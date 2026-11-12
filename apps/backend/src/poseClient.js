// Cliente del servicio de pose (apps/pose-service, Python + RTMPose). El servicio devuelve los 33 puntos del cuerpo por
// cuadro; aquí se arma con ellos el registro de sesión usando el MISMO motor que el navegador (runPosePass), así el
// análisis es idéntico sin importar qué modelo detectó el cuerpo.
import { EXERCISES, runPosePass } from "./engine.js";

export const POSE_MODES = ["lightweight", "balanced", "performance"];
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export class PoseServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createPoseClient({ url = process.env.POSE_SERVICE_URL, apiKey = process.env.POSE_API_KEY, fetchImpl = fetch, timeoutMs = 600_000 } = {}) {
  const base = url ? url.replace(/\/+$/, "") : null;
  const headers = apiKey ? { "x-api-key": apiKey } : {};

  async function call(path, init = {}, ms = 10_000) {
    if (!base) throw new PoseServiceError(503, "servicio de pose no configurado (defina POSE_SERVICE_URL)");
    let res;
    try {
      res = await fetchImpl(base + path, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(ms) });
    } catch (e) {
      throw new PoseServiceError(503, `servicio de pose no disponible: ${e.name === "TimeoutError" ? "tiempo agotado" : e.message}`);
    }
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail ?? ""; } catch { /* sin cuerpo JSON */ }
      // 4xx del servicio = problema del video (se informa tal cual); 5xx/401 = problema nuestro (502).
      const status = res.status >= 400 && res.status < 500 && res.status !== 401 ? res.status : 502;
      throw new PoseServiceError(status, `servicio de pose: ${detail || res.statusText}`);
    }
    return res.json();
  }

  return {
    configured: Boolean(base),
    status: async () => {
      if (!base) return { configured: false, available: false };
      try {
        return { configured: true, available: true, ...(await call("/health")) };
      } catch (e) {
        return { configured: true, available: false, error: e.message };
      }
    },
    /** Envía el video, recibe los puntos del cuerpo y arma el registro (formato telerehab-trace/2). */
    async traceFromVideo({ video, contentType, exerciseCode, side, targetAngle, mode = "balanced", stepMs = 66 }) {
      const exercise = EXERCISES[exerciseCode];
      if (!exercise) throw new PoseServiceError(400, "exercise_code sin medición con cámara");
      const form = new FormData();
      form.append("video", new Blob([video], { type: contentType }), "video.mp4");
      form.append("mode", mode);
      form.append("step_ms", String(stepMs));
      const out = await call("/pose/video", { method: "POST", body: form }, timeoutMs);

      const frames = out.frames;
      let k = 0;
      const { trace, seen, total } = await runPosePass({
        durationMs: frames.at(-1).t_ms,
        stepMs,
        getLandmarks: (t) => {
          while (k + 1 < frames.length && Math.abs(frames[k + 1].t_ms - t) <= Math.abs(frames[k].t_ms - t)) k++;
          return frames[k].landmarks;
        },
        exercise,
        side,
        targetAngle,
        frame: { width: out.width, height: out.height },
        meta: { model: out.model, startedAt: new Date().toISOString() },
      });
      return { trace, model: out.model, seen, total, processing_ms: out.processing_ms };
    },
  };
}
