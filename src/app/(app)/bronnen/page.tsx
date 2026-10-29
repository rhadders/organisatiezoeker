import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { startImport } from "@/features/enrichment/actions";
import { DENOMINATIONS } from "@/features/import/denominations";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime, formatNumber, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Bronnen" };

export default async function SourcesPage() {
  await requireUser();
  const [counts, imports, running] = await Promise.all([
    query<{ denomination: string; n: string; with_site: string; enriched: string; with_role: string }>(
      `select o.denomination, count(*) as n, count(*) filter (where website is not null) as with_site,
              count(*) filter (where enrichment_status in ('compleet','controleren','niets_gevonden')) as enriched,
              count(*) filter (where exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.email is not null and c.role in ('scriba','kerkelijk_bureau'))) as with_role
       from organizations o where type = 'kerk' group by 1 order by 1`,
    ),
    query<{ subject: string; created_at: string; details: Record<string, unknown> }>(
      "select subject, created_at, details from audit_log where action = 'import' order by created_at desc limit 8",
    ),
    query<{ denomination: string; status: string }>(
      "select payload->>'denomination' as denomination, status from jobs where step = 'import_denomination' and status in ('wachtrij','bezig')",
    ),
  ]);
  const byCode = new Map(counts.map((c) => [c.denomination, c]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Bronnen</h1>
        <p className="text-muted-foreground">
          De gemeentelijsten van de kerkverbanden zijn de basis. Opnieuw importeren voegt nieuwe gemeenten toe en werkt gewijzigde gegevens bij; niets
          wordt weggegooid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kerkverbanden</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={startImport} className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 text-left font-medium"> </th>
                    <th className="py-2 pr-3 text-left font-medium">Kerkverband</th>
                    <th className="py-2 pr-3 text-left font-medium">Bron</th>
                    <th className="py-2 pr-3 text-left font-medium">Gemeenten</th>
                    <th className="py-2 pr-3 text-left font-medium">Verrijkt</th>
                    <th className="py-2 pr-3 text-left font-medium">Scriba/bureau met e-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(DENOMINATIONS).map(([code, d]) => {
                    const c = byCode.get(code);
                    const n = Number(c?.n ?? 0);
                    const busy = running.find((r) => r.denomination === code);
                    return (
                      <tr key={code} className="border-t border-border">
                        <td className="py-3 pr-3">
                          <Checkbox id={`imp-${code}`} name="denomination" value={code} defaultChecked={!n} />
                        </td>
                        <td className="py-3 pr-3">
                          <Label htmlFor={`imp-${code}`} className="font-medium">
                            {code}
                          </Label>
                          <div className="text-xs text-muted-foreground">{d.label}</div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">{d.listUrl.replace(/^https?:\/\/(www\.)?/, "")}</td>
                        <td className="py-3 pr-3">
                          {formatNumber(n)}
                          {n ? <span className="text-xs text-muted-foreground"> · {percent(Number(c?.with_site ?? 0), n)} met website</span> : null}
                          {busy ? <Badge variant="accent" className="ml-2">{busy.status === "bezig" ? "Bezig" : "In wachtrij"}</Badge> : null}
                        </td>
                        <td className="py-3 pr-3">{n ? `${formatNumber(Number(c?.enriched ?? 0))} (${percent(Number(c?.enriched ?? 0), n)})` : "—"}</td>
                        <td className="py-3 pr-3">{n ? `${formatNumber(Number(c?.with_role ?? 0))} (${percent(Number(c?.with_role ?? 0), n)})` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div>
              <Button type="submit">Importeer geselecteerde kerkverbanden</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Laatste imports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm">
          {imports.map((i, k) => (
            <div key={k}>
              <span className="text-muted-foreground">{formatDateTime(i.created_at)}</span> · {i.subject}: {String(i.details?.seen ?? 0)} gezien,{" "}
              {String(i.details?.created ?? 0)} nieuw, {String(i.details?.updated ?? 0)} bijgewerkt
              {Number(i.details?.contacts ?? 0) ? `, ${String(i.details?.contacts)} contacten` : ""}
            </div>
          ))}
          {!imports.length ? <p className="text-muted-foreground">Nog geen imports gedaan.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hoe de tool verrijkt</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>1. De detailpagina van het kerkverband wordt structureel gelezen (NGK: e-mail scriba; HHK: naam en telefoon scriba; CGK: staat al op de lijst).</p>
          <p>2. Van de eigen website worden de homepage en hooguit acht pagina&apos;s opgehaald die lijken op contact, ANBI, organisatie of kerkenraad; ook pdf&apos;s.</p>
          <p>3. E-mailadressen die letterlijk op die pagina&apos;s staan krijgen een rol uit het adres zelf (scriba@, kerkelijkbureau@, info@).</p>
          <p>4. Een taalmodel koppelt namen aan rollen en geeft een score; onder 80 komt een vondst in de wachtrij &ldquo;Even meekijken&rdquo;.</p>
          <p>Eén verzoek per seconde per website, robots.txt wordt gerespecteerd, User-Agent met contactadres. Niets wordt afgeleid of geraden.</p>
        </CardContent>
      </Card>
    </div>
  );
}
