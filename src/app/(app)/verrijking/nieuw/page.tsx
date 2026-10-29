import type { Metadata } from "next";

import { buildWhere, parseFilter } from "@/features/organizations/search";
import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { formatNumber } from "@/lib/format";

import { NewRunForm } from "./new-run-form";

export const metadata: Metadata = { title: "Nieuwe run" };

export default async function NewRunPage(props: PageProps<"/verrijking/nieuw">) {
  await requireUser();
  const sp = await props.searchParams;
  const filter = parseFilter(sp);
  if (!filter.type) filter.type = "kerk";
  const { sql, params } = buildWhere(filter);
  const counts = await one<{ total: string; fresh: string }>(
    `select count(*) as total, count(*) filter (where o.enrichment_status = 'nieuw') as fresh from organizations o where ${sql} and o.blocked_at is null`,
    params,
  );
  const total = Number(counts?.total ?? 0);
  const fresh = Number(counts?.fresh ?? 0);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Nieuwe verrijkingsrun</h1>
        <p className="text-muted-foreground">
          {formatNumber(total)} organisaties in de huidige selectie, waarvan {formatNumber(fresh)} nog nooit verrijkt. Per organisatie haalt de tool de
          pagina van het kerkverband en hooguit negen pagina&apos;s van de eigen website op; reken op 20 tot 40 seconden per organisatie.
        </p>
      </div>
      <NewRunForm filter={filter} total={total} fresh={fresh} />
    </div>
  );
}
