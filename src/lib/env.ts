import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Omgevingsvariabele ${name} ontbreekt`);
  return value;
}

/** Alleen op de server gelezen; niets hiervan komt in de browser. */
export const env = {
  get SUPABASE_INTERNAL_URL() {
    return required("SUPABASE_INTERNAL_URL");
  },
  get SUPABASE_ANON_KEY() {
    return required("SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  get APP_URL() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get ANTHROPIC_API_KEY() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get KVK_API_KEY() {
    return process.env.KVK_API_KEY ?? "";
  },
  get CRAWLER_CONTACT() {
    return process.env.CRAWLER_CONTACT ?? "info@jonacommunicatie.nl";
  },
  get WORKER_ENABLED() {
    return (process.env.WORKER_ENABLED ?? "true") !== "false";
  },
};
