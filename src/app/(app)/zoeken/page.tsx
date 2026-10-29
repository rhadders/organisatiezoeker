import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleAlert, Clock, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DENOMINATIONS } from "@/features/import/denominations";
import { PROVINCES } from "@/features/organizations/province";
import { facetCounts, filterToQuery, parseFilter, searchOrganizations } from "@/features/organizations/search";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { daysAgo, formatNumber, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { FilterPanel } from "./filter-panel";
import { SaveSelection } from "./save-selection";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Zoeken" };

const STATUS_LABEL: Record<string, string> = {
  nieuw: "Nog niet verrijkt",
  bezig: "Bezig",
  compleet: "Compleet",
  controleren: "Te controleren",
  niets_gevonden: "Niets gevonden",
  fout: "Fout",
};

export default async function SearchPage(props: PageProps<"/zoeken">) {
  await requireUser();
  const sp = await props.searchParams;
  const filter = parseFilter(sp);
  if (!filter.type) filter.type = "kerk";
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [result, facets, roles, selections] = await Promise.all([
    searchOrganizations(filter, page),
    facetCounts(filter),
    query<{ key: string; label: string; applies_to: string }>("select key, label, applies_to from roles order by sort_order"),
    query<{ id: string; name: string; filter_json: Record<string, unknown> }>("select id, name, filter_json from saved_selections order by created_at desc limit 10"),
  ]);
  const noun = filter.type === "goed_doel" ? "goede doelen" : "kerken";
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const qs = filterToQuery(filter);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <aside className="flex w-full flex-col gap-6 md:w-[280px] md:shrink-0">
        <FilterPanel
          filter={filter}
          denominations={facets.denominations.map((d) => ({ key: d.key, label: DENOMINATIONS[d.key]?.label ?? d.key, n: d.n }))}
          provinces={PROVINCES.map((p) => ({ key: p, n: facets.provinces.find((x) => x.key === p)?.n ?? 0 }))}
          roles={roles.filter((r) => r.applies_to === "beide" || r.applies_to === filter.type)}
          selections={selections}
        />
      </aside>

      <section className="flex min-w-0 flex-1 basis-[560px] flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight">
              {formatNumber(result.total)} {noun}
            </h1>
            <p className="text-muted-foreground">
              waarvan {formatNumber(result.withEmail)} met een bruikbaar e-mailadres ({percent(result.withEmail, result.total)}) en{" "}
              {formatNumber(result.withRole)} met een gevonden rol ({percent(result.withRole, result.total)})
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <SaveSelection filter={filter} />
            <Button asChild variant="outline">
              <Link href={`/verrijking/nieuw${qs}`}>
                <Clock /> Verrijk deze selectie
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/exports/nieuw${qs}`}>
                <Download /> Exporteer {formatNumber(result.total)}
              </Link>
            </Button>
          </div>
        </div>

        <SearchBox filter={filter} />

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Organisatie</th>
                  <th className="px-3 py-3 text-left font-medium">Plaats</th>
                  <th className="px-3 py-3 text-left font-medium">Contact</th>
                  <th className="px-3 py-3 text-left font-medium">E-mail</th>
                  <th className="px-3 py-3 text-left font-medium">Bron</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => {
                  const email = r.contact_email ?? r.general_email;
                  const roleLabel = r.contact_email ? r.role_label : r.general_email ? "Algemeen adres" : null;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-mist-50">
                      <td className="px-5 py-3">
                        <Link href={`/organisaties/${r.id}`} className="font-medium text-foreground hover:text-brand-strong">
                          {r.name}
                        </Link>
                        <div className="mt-1 flex gap-1.5">
                          {r.denomination ? <Badge variant="secondary">{r.denomination}</Badge> : null}
                          {r.province ? <span className="text-xs text-muted-foreground">{r.province}</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">{r.place}</td>
                      <td className="px-3 py-3">
                        {r.contact_name ? <div>{r.contact_name}</div> : <div className={cn(!email && "text-muted-foreground")}>{email ? "Functioneel adres" : "Geen contact"}</div>}
                        {roleLabel ? <div className="text-xs text-muted-foreground">{roleLabel}</div> : null}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-3">{email ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-3 text-xs">
                        <StatusCell status={r.enrichment_status} seen={r.contact_seen ?? r.enriched_at} source={r.contact_source} />
                      </td>
                    </tr>
                  );
                })}
                {!result.rows.length ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Geen organisaties gevonden. Pas de filters aan of importeer eerst een kerkverband onder Bronnen.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span>
              {formatNumber(Math.min(result.total, (page - 1) * result.pageSize + 1))}–{formatNumber(Math.min(result.total, page * result.pageSize))} van{" "}
              {formatNumber(result.total)}
            </span>
            <div className="ml-auto flex gap-1.5">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/zoeken${qs}${qs ? "&" : "?"}page=${page - 1}`}>Vorige</Link>
                </Button>
              ) : null}
              <span className="px-2 py-1">
                pagina {page} van {pages}
              </span>
              {page < pages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/zoeken${qs}${qs ? "&" : "?"}page=${page + 1}`}>Volgende</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCell({ status, seen, source }: { status: string; seen: string | null; source: string | null }) {
  let host: string | null = null;
  try {
    host = source ? new URL(source).host.replace(/^www\./, "") : null;
  } catch {
    host = null;
  }
  if (status === "compleet")
    return (
      <span className="inline-flex items-center gap-1.5 text-success-strong">
        <Check className="size-3.5" /> {host ?? "Gevonden"} · {daysAgo(seen)}
      </span>
    );
  if (status === "controleren")
    return (
      <span className="inline-flex items-center gap-1.5 text-warning-strong">
        <CircleAlert className="size-3.5" /> Te controleren
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Clock className="size-3.5" /> {STATUS_LABEL[status] ?? status}
    </span>
  );
}
