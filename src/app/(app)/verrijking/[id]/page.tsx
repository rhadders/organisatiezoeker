import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { formatDateTime, formatNumber, percent } from "@/lib/format";

import { RunControls } from "./run-controls";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage(props: PageProps<"/verrijking/[id]">) {
  await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const run = await one<{
    id: string; name: string; status: string; total: number; done: number; found_role: number; review_count: number; not_found: number;
    cost_cents: string; created_at: string; started_at: string | null; finished_at: string | null; filter_json: Record<string, unknown>;
  }>("select * from enrichment_runs where id = $1", [id]);
  if (!run) notFound();

  const [stats, recent, failures] = await Promise.all([
    one<{ scriba: string; bureau: string; either: string; general_only: string }>(
      `select
         count(distinct o.id) filter (where exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status='zeker' and c.email is not null and c.role='scriba')) as scriba,
         count(distinct o.id) filter (where exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status='zeker' and c.email is not null and c.role='kerkelijk_bureau')) as bureau,
         count(distinct o.id) filter (where exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status='zeker' and c.email is not null and c.role in ('scriba','kerkelijk_bureau','fondsenwerving','communicatie','marketing'))) as either,
         count(distinct o.id) filter (where o.general_email is not null and not exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status='zeker' and c.email is not null and c.role <> 'algemeen')) as general_only
       from jobs j join organizations o on o.id = j.organization_id where j.run_id = $1 and j.status = 'klaar'`,
      [id],
    ),
    query<{ organization_id: string; name: string; status: string; finished_at: string | null; last_error: string | null; result: Record<string, unknown> | null }>(
      `select j.organization_id, o.name, j.status, j.finished_at, j.last_error, j.payload->'result' as result
       from jobs j join organizations o on o.id = j.organization_id where j.run_id = $1 and j.status <> 'wachtrij' order by j.finished_at desc nulls first limit 12`,
      [id],
    ),
    one<{ n: string }>("select count(*) as n from jobs where run_id = $1 and status = 'fout'", [id]),
  ]);
  const done = run.done;
  const pct = run.total ? Math.round((done / run.total) * 100) : 0;
  const remaining = run.total - done;
  const eta = remaining ? `nog ongeveer ${Math.max(1, Math.round((remaining * 30) / 60 / 3))} minuten` : "klaar";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/verrijking" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand-strong">
        <ChevronLeft className="size-4" /> Alle runs
      </Link>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="mb-1 text-2xs font-medium uppercase tracking-[0.14em] text-brand-strong">
            Verrijkingsrun · gestart {formatDateTime(run.started_at ?? run.created_at)}
          </div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">{run.name}</h1>
          <p className="text-muted-foreground">
            {formatNumber(run.total)} organisaties · kosten tot nu toe € {(Number(run.cost_cents) / 100).toFixed(2)}
          </p>
        </div>
        <RunControls runId={run.id} status={run.status} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">
              {formatNumber(done)} van {formatNumber(run.total)} verwerkt
            </span>
            <span className="text-sm text-muted-foreground">
              {pct}% · {run.status === "gepauzeerd" ? "gepauzeerd" : eta}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-mist-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <Dot color="bg-success" label={`${formatNumber(run.found_role)} compleet`} />
            <Dot color="bg-warning" label={`${formatNumber(run.review_count)} te controleren`} />
            <Dot color="bg-destructive" label={`${formatNumber(run.not_found)} niets gevonden`} />
            <Dot color="bg-mist-300" label={`${formatNumber(remaining)} in wachtrij`} />
            {Number(failures?.n ?? 0) ? <Dot color="bg-destructive" label={`${failures?.n} mislukt`} /> : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Stat label="Scriba gevonden" value={Number(stats?.scriba ?? 0)} total={done} />
        <Stat label="Kerkelijk bureau" value={Number(stats?.bureau ?? 0)} total={done} />
        <Stat label="Rol met e-mail" value={Number(stats?.either ?? 0)} total={done} />
        <Stat label="Alleen algemeen adres" value={Number(stats?.general_only ?? 0)} total={done} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Laatst verwerkt</th>
                <th className="px-3 py-2.5 text-left font-medium">Uitkomst</th>
                <th className="px-3 py-2.5 text-left font-medium">Tijd</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.organization_id + (r.finished_at ?? "")} className="border-t border-border">
                  <td className="px-5 py-2.5">
                    <Link href={`/organisaties/${r.organization_id}`} className="hover:text-brand-strong">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status === "fout" ? (
                      <Badge variant="destructive">{r.last_error?.slice(0, 80) ?? "Fout"}</Badge>
                    ) : r.status === "bezig" ? (
                      <Badge variant="secondary">Bezig</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {String(r.result?.status ?? "")} · {String(r.result?.added ?? 0)} nieuw · {String(r.result?.pages ?? 0)} pagina&apos;s
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDateTime(r.finished_at)}</td>
                </tr>
              ))}
              {!recent.length ? (
                <tr>
                  <td colSpan={3} className="px-5 py-6 text-center text-muted-foreground">
                    De worker pakt de eerste organisatie binnen tien seconden op.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${color}`} /> {label}
    </span>
  );
}

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <Card className="min-w-[150px] flex-1">
      <CardContent className="flex flex-col gap-1 pt-5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-serif text-2xl font-medium tracking-tight">{formatNumber(value)}</span>
        <span className="text-xs text-muted-foreground">{percent(value, total)} van verwerkt</span>
      </CardContent>
    </Card>
  );
}
