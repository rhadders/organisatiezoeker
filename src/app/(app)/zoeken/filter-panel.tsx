"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { filterToQuery, type SearchFilter } from "@/features/organizations/search-shared";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Facet = { key: string; label?: string; n: number };

export function FilterPanel({
  filter,
  denominations,
  provinces,
  roles,
  selections,
}: {
  filter: SearchFilter;
  denominations: Facet[];
  provinces: Facet[];
  roles: { key: string; label: string }[];
  selections: { id: string; name: string; filter_json: Record<string, unknown> }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const update = (patch: Partial<SearchFilter>) => {
    start(() => router.push(`/zoeken${filterToQuery({ ...filter, ...patch })}`));
  };
  const toggle = (key: keyof SearchFilter, value: string) => {
    const list = (filter[key] as string[] | undefined) ?? [];
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] } as Partial<SearchFilter>);
  };

  return (
    <div className={cn("flex flex-col gap-6", pending && "opacity-60")}>
      <Section title="Soort organisatie">
        <div className="flex flex-wrap gap-2">
          {[
            ["kerk", "Kerken"],
            ["goed_doel", "Goede doelen"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ type: value as SearchFilter["type"], denominations: [], roles: [] })}
              className={cn(
                "h-8 rounded-full border px-3 text-xs transition-colors",
                filter.type === value ? "border-brand bg-brand-soft text-brand-strong" : "border-border bg-card hover:border-primary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {denominations.length ? (
        <Section title={filter.type === "goed_doel" ? "Register" : "Kerkverband"}>
          {denominations.map((d) => (
            <Option key={d.key} id={`denom-${d.key}`} checked={filter.denominations?.includes(d.key) ?? false} onChange={() => toggle("denominations", d.key)} count={d.n}>
              {d.key}
              {d.label && d.label !== d.key ? <span className="ml-1 text-xs text-muted-foreground">{d.label}</span> : null}
            </Option>
          ))}
        </Section>
      ) : null}

      <Section title="Provincie">
        {provinces.map((p) => (
          <Option key={p.key} id={`prov-${p.key}`} checked={filter.provinces?.includes(p.key) ?? false} onChange={() => toggle("provinces", p.key)} count={p.n}>
            {p.key}
          </Option>
        ))}
      </Section>

      <Section title="Contactpersoon met rol">
        {roles
          .filter((r) => r.key !== "algemeen")
          .map((r) => (
            <Option key={r.key} id={`rol-${r.key}`} checked={filter.roles?.includes(r.key) ?? false} onChange={() => toggle("roles", r.key)}>
              {r.label}
            </Option>
          ))}
        <p className="mt-1 text-xs text-muted-foreground">
          Een selectie, geen beperking: organisaties zonder deze rol exporteren met hun algemene adres zodra je het filter weghaalt.
        </p>
      </Section>

      <Section title="Gegevens">
        <Option id="email" checked={!!filter.hasEmail} onChange={() => update({ hasEmail: !filter.hasEmail })}>
          Heeft bruikbaar e-mailadres
        </Option>
        <Option id="ver" checked={!!filter.verifiedDays} onChange={() => update({ verifiedDays: filter.verifiedDays ? undefined : 90 })}>
          Gecontroleerd in de laatste 90 dagen
        </Option>
        <Option id="nexp" checked={!!filter.notExportedDays} onChange={() => update({ notExportedDays: filter.notExportedDays ? undefined : 90 })}>
          Niet geëxporteerd in de laatste 90 dagen
        </Option>
        <Option id="st-nieuw" checked={filter.statuses?.includes("nieuw") ?? false} onChange={() => toggle("statuses", "nieuw")}>
          Nog niet verrijkt
        </Option>
        <Option id="st-ctrl" checked={filter.statuses?.includes("controleren") ?? false} onChange={() => toggle("statuses", "controleren")}>
          Te controleren
        </Option>
      </Section>

      {selections.length ? (
        <Section title="Bewaarde selecties">
          <ul className="flex flex-col gap-1 text-sm">
            {selections.map((s) => (
              <li key={s.id}>
                <Link href={`/zoeken${filterToQuery(s.filter_json as SearchFilter)}`} className="text-navy-700 hover:text-brand-strong">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Button variant="outline" onClick={() => update({ q: "", denominations: [], provinces: [], roles: [], hasEmail: false, verifiedDays: undefined, notExportedDays: undefined, statuses: [] })}>
        Wis alle filters
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-2xs font-medium uppercase tracking-[0.14em] text-brand-strong">{title}</div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Option({ id, checked, onChange, count, children }: { id: string; checked: boolean; onChange: () => void; count?: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="flex flex-1 cursor-pointer items-center text-sm font-normal">
        <span>{children}</span>
        {count !== undefined ? <span className="ml-auto text-xs text-muted-foreground">{formatNumber(count)}</span> : null}
      </Label>
    </div>
  );
}
