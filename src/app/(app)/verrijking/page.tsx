import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { formatDateTime, formatNumber, percent } from "@/lib/format";

import { ReviewQueue } from "./review-queue";

export const metadata: Metadata = { title: "Verrijking" };

const RUN_STATUS: Record<string, { label: string; variant: "secondary" | "accent" | "success" | "warning" | "destructive" }> = {
  wachtrij: { label: "In wachtrij", variant: "secondary" },
  bezig: { label: "Bezig", variant: "accent" },
  gepauzeerd: { label: "Gepauzeerd", variant: "warning" },
  klaar: { label: "Klaar", variant: "success" },
  fout: { label: "Fout", variant: "destructive" },
};

export default async function EnrichmentPage() {
  await requireUser();
  const [runs, totals, review] = await Promise.all([
    query<{ id: string; name: string; status: string; total: number; done: number; found_role: number; review_count: number; not_found: number; cost_cents: string; created_at: string; started_at: string | null }>(
      "select * from enrichment_runs order by created_at desc limit 20",
    ),
    one<{ orgs: string; enriched: string; review: string; with_role: string }>(
      `select count(*) as orgs,
              count(*) filter (where enrichment_status in ('compleet','controleren','niets_gevonden')) as enriched,
              count(*) filter (where enrichment_status = 'controleren') as review,
              (select count(distinct organization_id) from contacts where is_current and status = 'zeker' and email is not null and role <> 'algemeen') as with_role
       from organizations where blocked_at is null`,
    ),
    query<ReviewItem>(
      `select c.id, c.display_name, c.role, r.label as role_label, c.email, c.confidence, c.evidence, c.reason, c.source_url,
              o.id as organization_id, o.name as organization_name, o.place, o.denomination, o.type
       from contacts c join roles r on r.key = c.role join organizations o on o.id = c.organization_id
       where c.is_current and c.status = 'te_controleren'
       order by c.confidence desc, o.name limit 25`,
    ),
  ]);
  const roles = await query<{ key: string; label: string; applies_to: string }>("select key, label, applies_to from roles order by sort_order");
  const reviewTotal = await one<{ n: string }>("select count(*) as n from contacts where is_current and status = 'te_controleren'");
  const orgs = Number(totals?.orgs ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Verrijking</h1>
          <p className="text-muted-foreground">
            {formatNumber(Number(totals?.enriched ?? 0))} van {formatNumber(orgs)} organisaties verrijkt ({percent(Number(totals?.enriched ?? 0), orgs)}),{" "}
            {formatNumber(Number(totals?.with_role ?? 0))} met e-mail bij een rol ({percent(Number(totals?.with_role ?? 0), orgs)})
          </p>
        </div>
        <Button asChild className="ml-auto">
          <Link href="/verrijking/nieuw">
            <Plus /> Nieuwe run
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Run</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Voortgang</th>
                  <th className="px-3 py-2.5 text-left font-medium">Resultaat</th>
                  <th className="px-3 py-2.5 text-left font-medium">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const st = RUN_STATUS[r.status] ?? RUN_STATUS.wachtrij;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-mist-50">
                      <td className="px-5 py-3">
                        <Link href={`/verrijking/${r.id}`} className="font-medium hover:text-brand-strong">
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-mist-200">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatNumber(r.done)}/{formatNumber(r.total)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatNumber(r.found_role)} compleet · {formatNumber(r.review_count)} te controleren · {formatNumber(r.not_found)} niets
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">€ {(Number(r.cost_cents) / 100).toFixed(2)}</td>
                    </tr>
                  );
                })}
                {!runs.length ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Nog geen runs. Importeer eerst kerkverbanden onder Bronnen en start dan een run.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ReviewQueue items={review} total={Number(reviewTotal?.n ?? 0)} roles={roles} />
    </div>
  );
}

export type ReviewItem = {
  id: string; display_name: string | null; role: string; role_label: string; email: string | null; confidence: number; evidence: string | null;
  reason: string | null; source_url: string | null; organization_id: string; organization_name: string; place: string | null; denomination: string | null; type: string;
};
