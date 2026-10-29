"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startRun, type SimpleResult } from "@/features/enrichment/actions";
import { filterToQuery, type SearchFilter } from "@/features/organizations/search-shared";
import { formatNumber } from "@/lib/format";

export function NewRunForm({ filter, total, fresh }: { filter: SearchFilter; total: number; fresh: number }) {
  const [state, action, pending] = useActionState<SimpleResult | null, FormData>(startRun, null);
  const params = new URLSearchParams(filterToQuery(filter).replace(/^\?/, ""));

  return (
    <form action={action} noValidate className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
      {[...params.entries()].map(([k, v]) => (
        <input key={k} type="hidden" name={`f_${k}`} value={v} />
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-name">Naam van de run</Label>
        <Input id="run-name" name="name" placeholder="Bijvoorbeeld: Kerken Gelderland en Utrecht" />
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox id="onlyNew" name="onlyNew" defaultChecked={fresh > 0 && fresh < total} />
        <Label htmlFor="onlyNew" className="font-normal">
          Alleen organisaties die nog nooit verrijkt zijn ({formatNumber(fresh)})
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">
        Filters: {describe(filter)}. Pas ze aan onder Zoeken.
      </p>
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending || !total}>
          Start run voor {formatNumber(total)} organisaties
        </Button>
      </div>
    </form>
  );
}

function describe(f: SearchFilter) {
  const parts: string[] = [];
  parts.push(f.type === "goed_doel" ? "goede doelen" : "kerken");
  if (f.denominations?.length) parts.push(f.denominations.join(", "));
  if (f.provinces?.length) parts.push(f.provinces.join(", "));
  if (f.q) parts.push(`"${f.q}"`);
  if (f.roles?.length) parts.push(`rol ${f.roles.join("/")}`);
  if (f.statuses?.length) parts.push(`status ${f.statuses.join("/")}`);
  return parts.join(" · ");
}
