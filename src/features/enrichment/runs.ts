import "server-only";

import { one, query } from "@/lib/db";

import { buildWhere, type SearchFilter } from "@/features/organizations/search";

/** Zet een verrijkingsrun klaar voor alle organisaties die aan het filter voldoen. */
export async function createRun(name: string, filter: SearchFilter, options: { onlyNew?: boolean } = {}) {
  const { sql, params } = buildWhere(filter);
  const run = await one<{ id: string }>(
    "insert into enrichment_runs (name, filter_json, status) values ($1, $2, 'wachtrij') returning id",
    [name, JSON.stringify(filter)],
  );
  const runId = run!.id;
  const extra = options.onlyNew ? " and o.enrichment_status = 'nieuw'" : "";
  const inserted = await query<{ id: string }>(
    `insert into jobs (run_id, organization_id, step, scheduled_at)
     select $${params.length + 1}, o.id, 'enrich', now() + (row_number() over (order by o.denomination, o.name)) * interval '1 second'
     from organizations o
     where ${sql} and o.blocked_at is null${extra}
     returning id`,
    [...params, runId],
  );
  await query("update enrichment_runs set total = $2 where id = $1", [runId, inserted.length]);
  return { runId, total: inserted.length };
}

export async function createImportRun(denominations: string[]) {
  const run = await one<{ id: string }>(
    "insert into enrichment_runs (name, filter_json, status, total) values ($1, $2, 'wachtrij', $3) returning id",
    [`Import ${denominations.join(", ")}`, JSON.stringify({ denominations }), denominations.length],
  );
  for (const d of denominations) {
    await query("insert into jobs (run_id, step, payload) values ($1, 'import_denomination', $2)", [run!.id, JSON.stringify({ denomination: d })]);
  }
  return run!.id;
}

export async function pauseRun(runId: string) {
  await query("update enrichment_runs set status = 'gepauzeerd' where id = $1 and status in ('wachtrij','bezig')", [runId]);
}

export async function resumeRun(runId: string) {
  await query("update enrichment_runs set status = 'bezig' where id = $1 and status = 'gepauzeerd'", [runId]);
}

export async function enqueueSingle(orgId: string) {
  const open = await one("select 1 from jobs where organization_id = $1 and step = 'enrich' and status in ('wachtrij','bezig')", [orgId]);
  if (open) return;
  await query("insert into jobs (organization_id, step) values ($1, 'enrich')", [orgId]);
}
