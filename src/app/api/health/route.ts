/*
 * Controle-eindpunt voor de workflow die het image uitrolt (deploy-image.yml):
 * zegt dat het Node-proces antwoordt en uit welke commit het image komt
 * (SOURCE_COMMIT uit de Dockerfile). Geen Supabase, geen sessie; de proxy
 * (src/proxy.ts) slaat deze route over. De healthcheck van de container
 * (docker-compose.yml) gebruikt /login.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, commit: process.env.SOURCE_COMMIT?.slice(0, 7) ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
