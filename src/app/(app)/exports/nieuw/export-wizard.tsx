"use client";

import { ArrowDown, ArrowUp, Download, X } from "lucide-react";
import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createExport, type SimpleResult } from "@/features/export/actions";
import { filterToQuery, type SearchFilter } from "@/features/organizations/search-shared";
import { formatDate, formatNumber, percent } from "@/lib/format";

type PreviewRow = { organisatie: string; plaats: string | null; type: string | null; contactpersoon: string | null; rol: string | null; email: string | null; bron: string | null; gezien: string | null };

export function ExportWizard({
  filter,
  roles,
  preference: initial,
  columns,
  previewRows,
  total,
  skippedRecent,
  perRole,
}: {
  filter: SearchFilter;
  roles: { key: string; label: string }[];
  preference: string[];
  columns: { key: string; label: string; default: boolean }[];
  previewRows: PreviewRow[];
  total: number;
  skippedRecent: number;
  perRole: { rol: string; n: number }[];
}) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(createExport, null);
  const [preference, setPreference] = useState(initial);
  const [skipRecent, setSkipRecent] = useState(true);
  const [addRole, setAddRole] = useState("");
  const params = new URLSearchParams(filterToQuery(filter).replace(/^\?/, ""));
  const label = (key: string) => roles.find((r) => r.key === key)?.label ?? key;
  const move = (i: number, d: -1 | 1) => {
    const next = [...preference];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setPreference(next);
  };
  const expected = skipRecent ? total - skippedRecent : total;

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {[...params.entries()].map(([k, v]) => (
        <input key={k} type="hidden" name={`f_${k}`} value={v} />
      ))}
      <input type="hidden" name="preference" value={preference.join(",")} />

      <div>
        <div className="mb-1 text-2xs font-medium uppercase tracking-[0.14em] text-brand-strong">Nieuwe export</div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Exporteren</h1>
        <p className="text-muted-foreground">
          {formatNumber(total)} organisaties met een bruikbaar e-mailadres in de huidige selectie
          {skippedRecent ? `; ${formatNumber(skippedRecent)} (${percent(skippedRecent, total)}) zijn in de laatste 90 dagen al geëxporteerd` : ""}.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex w-full max-w-[460px] flex-col gap-4 md:flex-1 md:basis-[380px]">
          <Card>
            <CardHeader>
              <CardTitle>Welk e-mailadres gaat mee?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">De tool kiest per organisatie het eerste adres dat bestaat, in deze volgorde.</p>
              <ol className="flex flex-col gap-2">
                {preference.map((key, i) => (
                  <li key={key} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">{i + 1}</span>
                    <span className="flex-1">{label(key)}</span>
                    <span className="text-xs text-muted-foreground">{perRole.find((p) => p.rol === label(key))?.n ?? 0}</span>
                    <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Omhoog" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Omlaag" onClick={() => move(i, 1)} disabled={i === preference.length - 1}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Verwijder" onClick={() => setPreference(preference.filter((p) => p !== key))}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Voeg rol toe" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((r) => !preference.includes(r.key))
                      .map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {r.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!addRole}
                  onClick={() => {
                    if (addRole) setPreference([...preference, addRole]);
                    setAddRole("");
                  }}
                >
                  Voeg toe
                </Button>
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <Checkbox id="allContacts" name="allContacts" />
                <Label htmlFor="allContacts" className="font-normal">
                  Neem álle gevonden contactpersonen mee (één rij per persoon)
                </Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="includePersonal" name="includePersonal" />
                <Label htmlFor="includePersonal" className="font-normal">
                  Inclusief persoonlijke werkadressen (standaard uit, AVG)
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kolommen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1">
              {columns.map((c) => (
                <div key={c.key} className="flex items-center gap-2.5 py-1">
                  <Checkbox id={`col-${c.key}`} name="column" value={c.key} defaultChecked={c.default} />
                  <Label htmlFor={`col-${c.key}`} className="font-normal">
                    {c.label}
                  </Label>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bestand</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="exp-name">Naam</Label>
                <Input id="exp-name" name="name" placeholder="Bijvoorbeeld: Kerken Gelderland en Utrecht" />
              </div>
              <div className="flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="format" value="xlsx" defaultChecked className="accent-navy-800" /> Excel (.xlsx)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="format" value="csv" className="accent-navy-800" /> CSV (puntkomma, UTF-8)
                </label>
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="skipRecent" name="skipRecent" checked={skipRecent} onCheckedChange={(v) => setSkipRecent(v === true)} />
                <Label htmlFor="skipRecent" className="font-normal">
                  Laat organisaties weg die in de laatste 90 dagen al zijn geëxporteerd (− {formatNumber(skippedRecent)})
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-1 basis-[520px] flex-col gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-3">
              <CardTitle>Voorbeeld</CardTitle>
              <span className="text-sm text-muted-foreground">eerste {previewRows.length} van {formatNumber(total)} rijen (standaardvolgorde)</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      {["Organisatie", "Plaats", "Type", "Contactpersoon", "Rol", "E-mail", "Bron · datum"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{r.organisatie}</td>
                        <td className="px-3 py-2">{r.plaats}</td>
                        <td className="px-3 py-2">{r.type}</td>
                        <td className="px-3 py-2">{r.contactpersoon ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">{r.rol}</td>
                        <td className="px-3 py-2">{r.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.bron ? r.bron.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32) : ""} · {formatDate(r.gezien)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-ink p-6 text-ink-foreground">
            <div className="min-w-0 flex-1 basis-[300px]">
              <div className="font-serif text-xl font-medium tracking-tight">{formatNumber(expected)} rijen, klaar om te maken</div>
              <p className="mt-1 text-sm text-ink-muted">
                Alle gegevens komen van openbare pagina&apos;s van de organisaties zelf. Bron en datum staan per rij; de export wordt bewaard.
              </p>
            </div>
            {state && !state.ok ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" variant="accent" size="lg" disabled={pending || !expected}>
              <Download /> {pending ? "Bezig" : "Maak export"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
