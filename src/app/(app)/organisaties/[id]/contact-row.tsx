"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { removeContact, setContactStatus } from "@/features/organizations/actions";
import { formatDate } from "@/lib/format";

type Contact = {
  id: string; display_name: string | null; role: string; role_label: string; email: string | null; email_kind: string | null;
  phone: string | null; source_url: string | null; seen_at: string | null; confidence: number; status: string; evidence: string | null; reason: string | null; origin: string;
};

export function ContactRow({ contact: c, roles }: { contact: Contact; roles: { key: string; label: string }[] }) {
  const [pending, start] = useTransition();
  const [role, setRole] = useState(c.role);
  const review = c.status === "te_controleren";

  return (
    <tr className={review ? "border-t border-border bg-warning-soft/30" : c.status === "verworpen" ? "border-t border-border opacity-50" : "border-t border-border"}>
      <td className="px-5 py-3">
        <div className="font-medium">{c.display_name ?? (c.email ? "Functioneel adres" : "—")}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {review ? (
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
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
          ) : (
            <Badge variant="accent">{c.role_label}</Badge>
          )}
          {c.origin === "handmatig" ? <span className="text-xs text-muted-foreground">handmatig</span> : null}
        </div>
      </td>
      <td className="px-3 py-3">
        {c.email ? (
          <>
            <div className="truncate">{c.email}</div>
            <div className="text-xs text-muted-foreground">{c.email_kind === "persoonlijk" ? "Persoonlijk werkadres" : "Functioneel adres"}</div>
          </>
        ) : (
          <>
            <div className="text-muted-foreground">Geen e-mail gepubliceerd</div>
            {c.phone ? <div className="text-xs text-muted-foreground">{c.phone}</div> : null}
          </>
        )}
      </td>
      <td className="max-w-[240px] px-3 py-3">
        {c.source_url ? (
          <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-navy-700 hover:text-brand-strong">
            <span className="truncate">{c.source_url.replace(/^https?:\/\/(www\.)?/, "")}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : null}
        <div className="text-xs text-muted-foreground">
          {c.seen_at ? `Gezien ${formatDate(c.seen_at)}` : ""}
          {c.reason ? ` · ${c.reason}` : ""}
        </div>
        {review && c.evidence ? <div className="mt-1 rounded-md bg-mist-100 px-2 py-1 font-mono text-xs text-mist-600">&ldquo;{c.evidence}&rdquo;</div> : null}
      </td>
      <td className="px-3 py-3">
        {review ? (
          <div className="flex gap-1.5">
            <Button
              size="icon"
              variant="outline"
              aria-label="Klopt"
              disabled={pending}
              className="text-success-strong"
              onClick={() => start(async () => void (await setContactStatus({ contactId: c.id, status: "zeker", role })))}
            >
              <Check />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Verwerp"
              disabled={pending}
              className="text-destructive"
              onClick={() => start(async () => void (await setContactStatus({ contactId: c.id, status: "verworpen" })))}
            >
              <X />
            </Button>
          </div>
        ) : c.status === "zeker" ? (
          <div className="flex items-center gap-2">
            <Badge variant="success">Zeker</Badge>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await removeContact(c.id)))}>
              Verwijder
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Verworpen</Badge>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await setContactStatus({ contactId: c.id, status: "zeker" })))}>
              Toch klopt
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
