/*
 * Draait één keer bij de start van de server. De worker leeft in hetzelfde
 * proces als de app: geen aparte dienst, geen cron.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startWorker } = await import("@/features/jobs/worker");
    startWorker();
  }
}
