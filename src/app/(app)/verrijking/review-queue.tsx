"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmAllAbove } from "@/features/enrichment/actions";
import { setContactStatus } from "@/features/organizations/actions";
import { formatNumber } from "@/lib/format";

import type { ReviewItem } from "./page";

export function ReviewQueue({ items, total, roles }: { items: ReviewItem[]; total: number; roles: { key: string; label: string; applies_to: string }[] }) {
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3">
        <CardTitle>Even meekijken</CardTitle>
        <span className="text-sm text-muted-foreground">
          {formatNumber(total)} vondsten waar de tool niet zeker van is. Bevestigen of verwerpen, meer hoeft niet.
        </span>
        {total ? (
          <Button variant="outline" size="sm" className="ml-auto" disabled={pending} onClick={() => start(async () => void (await confirmAllAbove(70)))}>
            Bevestig alle met score 70 of hoger
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border p-0">
        {items.map((it) => (
          <Row key={it.id} item={it} roles={roles.filter((r) => r.applies_to === "beide" || r.applies_to === it.type)} />
        ))}
        {!items.length ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Niets te controleren.</p> : null}
        {total > items.length ? (
          <p className="px-5 py-3 text-xs text-muted-foreground">
            {items.length} van {formatNumber(total)} getoond; de rest verschijnt zodra deze zijn afgehandeld.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ item: it, roles }: { item: ReviewItem; roles: { key: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [role, setRole] = useState(it.role);
  const [done, setDone] = useState<string | null>(null);
  if (done) return null;

  return (
    <div className="flex flex-wrap items-start gap-5 px-5 py-4">
      <div className="min-w-0 flex-1 basis-[240px]">
        <div className="mb-1 flex gap-1.5">
          {it.denomination ? <Badge variant="secondary">{it.denomination}</Badge> : null}
          <Badge variant="warning">Score {it.confidence}</Badge>
        </div>
        <Link href={`/organisaties/${it.organization_id}`} className="font-medium hover:text-brand-strong">
          {it.organization_name}
        </Link>
        <div className="text-xs text-muted-foreground">
          {it.place}
          {it.source_url ? (
            <>
              {" · "}
              <a href={it.source_url} target="_blank" rel="noreferrer" className="hover:text-brand-strong">
                {it.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
              </a>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-[2] basis-[360px] flex-col gap-2">
        {it.evidence ? <div className="rounded-md border border-border bg-mist-50 px-3 py-2 font-mono text-xs text-mist-600">&ldquo;{it.evidence}&rdquo;</div> : null}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Voorstel:</span>
          <span className="font-medium">{it.display_name ?? "Functioneel adres"}</span>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-7 w-auto min-w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {it.email ? <span className="text-muted-foreground">{it.email}</span> : <span className="text-muted-foreground">geen e-mail</span>}
          {it.reason ? <span className="text-xs text-muted-foreground">· {it.reason}</span> : null}
        </div>
      </div>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="text-success-strong"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setContactStatus({ contactId: it.id, status: "zeker", role });
              if (r.ok) setDone("ok");
            })
          }
        >
          <Check /> Klopt
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setContactStatus({ contactId: it.id, status: "verworpen" });
              if (r.ok) setDone("weg");
            })
          }
        >
          <X /> Verwerp
        </Button>
      </div>
    </div>
  );
}
