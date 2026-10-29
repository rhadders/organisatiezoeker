import "server-only";

import { enrichOrganization } from "@/features/enrichment/enrich";
import { importDenomination } from "@/features/import/denominations";
import { one, query } from "@/lib/db";
import { env } from "@/lib/env";

type Job = {
  id: string; run_id: string | null; organization_id: string | null; step: string;
  payload: Record<string, unknown>; attempts: number;
};

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
let running = false;

/** Eén tik van de worker: pakt tot CONCURRENCY jobs en verwerkt ze parallel. */
export async function runTick(): Promise<number> {
  if (running) return 0;
  running = true;
  let handled = 0;
  try {
    const claims = await Promise.all(Array.from({ length: CONCURRENCY }, () => claim()));
    const jobs = claims.filter((j): j is Job => !!j);
    await Promise.all(jobs.map((j) => execute(j)));
    handled = jobs.length;
  } finally {
    running = false;
  }
  return handled;
}

async function claim(): Promise<Job | null> {
  return one<Job>(
    `update jobs set status = 'bezig', started_at = now(), attempts = attempts + 1
     where id = (
       select j.id from jobs j
       left join enrichment_runs r on r.id = j.run_id
       where j.status = 'wachtrij' and j.scheduled_at <= now() and (r.id is null or r.status in ('wachtrij','bezig'))
       order by j.scheduled_at
       for update of j skip locked
       limit 1)
     returning id, run_id, organization_id, step, payload, attempts`,
  );
}

async function execute(job: Job) {
  try {
    if (job.run_id) await query("update enrichment_runs set status = 'bezig', started_at = coalesce(started_at, now()) where id = $1", [job.run_id]);
    let result: Record<string, unknown> = {};
    switch (job.step) {
      case "import_denomination": {
        const report = await importDenomination(String(job.payload.denomination));
        result = report;
        await query("insert into audit_log (actor, action, subject, details) values ('worker','import',$1,$2)", [report.denomination, JSON.stringify(report)]);
        break;
      }
      case "enrich": {
        if (!job.organization_id) throw new Error("Geen organisatie bij deze job");
        result = await enrichOrganization(job.organization_id);
        break;
      }
      default:
        throw new Error(`Onbekende stap ${job.step}`);
    }
    await query("update jobs set status = 'klaar', finished_at = now(), payload = payload || $2 where id = $1", [job.id, JSON.stringify({ result })]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retry = job.attempts < MAX_ATTEMPTS;
    await query(
      `update jobs set status = $2, last_error = $3, finished_at = case when $2 = 'fout' then now() else null end,
         scheduled_at = case when $2 = 'wachtrij' then now() + interval '2 minutes' else scheduled_at end
       where id = $1`,
      [job.id, retry ? "wachtrij" : "fout", message.slice(0, 500)],
    );
    if (!retry && job.organization_id) {
      await query("update organizations set enrichment_status = 'fout' where id = $1", [job.organization_id]);
    }
  } finally {
    if (job.run_id) await refreshRun(job.run_id);
  }
}

/** Tellers van een run bijwerken uit de jobs en de organisaties. */
export async function refreshRun(runId: string) {
  await query(
    `update enrichment_runs r set
       done = s.done,
       found_role = s.found_role,
       review_count = s.review_count,
       not_found = s.not_found,
       cost_cents = s.cost_cents,
       status = case when s.open = 0 and r.status <> 'gepauzeerd' then 'klaar' else r.status end,
       finished_at = case when s.open = 0 then coalesce(r.finished_at, now()) else null end
     from (
       select
         count(*) filter (where j.status in ('klaar','fout','overgeslagen')) as done,
         count(*) filter (where j.status in ('wachtrij','bezig')) as open,
         count(*) filter (where o.enrichment_status = 'compleet') as found_role,
         count(*) filter (where o.enrichment_status = 'controleren') as review_count,
         count(*) filter (where o.enrichment_status in ('niets_gevonden','fout')) as not_found,
         coalesce((select sum(a.cost_cents) from ai_calls a where a.created_at >= coalesce((select started_at from enrichment_runs where id = $1), now())), 0) as cost_cents
       from jobs j left join organizations o on o.id = j.organization_id
       where j.run_id = $1
     ) s
     where r.id = $1`,
    [runId],
  );
}

let timer: NodeJS.Timeout | null = null;

/** Start de lus (één keer per proces). */
export function startWorker() {
  if (timer || !env.WORKER_ENABLED) return;
  timer = setInterval(() => {
    runTick().catch((err) => console.error("worker", err instanceof Error ? err.message : err));
  }, 10_000);
  timer.unref();
  console.log("Worker gestart (elke 10 s)");
}
