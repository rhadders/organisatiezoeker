import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { daysAgo, formatDate, formatDateTime } from "@/lib/format";

import { ContactRow } from "./contact-row";
import { OrgActions } from "./org-actions";

export const metadata: Metadata = { title: "Organisatie" };

type Org = {
  id: string; type: "kerk" | "goed_doel"; name: string; place: string | null; province: string | null; website: string | null;
  rsin: string | null; kvk_number: string | null; denomination: string | null; classis: string | null; general_email: string | null;
  postal_address: string | null; enrichment_status: string; enriched_at: string | null; blocked_at: string | null; source_list: string | null;
};

export default async function OrganizationPage(props: PageProps<"/organisaties/[id]">) {
  await requireUser();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const org = await one<Org>("select * from organizations where id = $1", [id]);
  if (!org) notFound();

  const [contacts, sources, changes, roles, pending] = await Promise.all([
    query<{
      id: string; display_name: string | null; role: string; role_label: string; email: string | null; email_kind: string | null;
      phone: string | null; source_url: string | null; seen_at: string | null; confidence: number; status: string; evidence: string | null; reason: string | null; origin: string;
    }>(
      `select c.*, r.label as role_label from contacts c join roles r on r.key = c.role
       where c.organization_id = $1 and c.is_current order by r.sort_order, c.confidence desc`,
      [id],
    ),
    query<{ kind: string; url: string; fetched_at: string; http_status: number | null; title: string | null }>(
      "select kind, url, fetched_at, http_status, title from sources where organization_id = $1 order by fetched_at desc limit 20",
      [id],
    ),
    query<{ field: string; old_value: string | null; new_value: string | null; changed_at: string }>(
      "select field, old_value, new_value, changed_at from change_log where organization_id = $1 order by changed_at desc limit 15",
      [id],
    ),
    query<{ key: string; label: string }>("select key, label from roles where applies_to = 'beide' or applies_to = $1 order by sort_order", [org.type]),
    one<{ n: string }>("select count(*) as n from jobs where organization_id = $1 and status in ('wachtrij','bezig')", [id]),
  ]);
  const exportsOf = await query<{ name: string; created_at: string }>(
    "select e.name, e.created_at from export_rows er join exports e on e.id = er.export_id where er.organization_id = $1 order by e.created_at desc limit 5",
    [id],
  );
  const usable = contacts.filter((c) => c.status === "zeker" && c.email).length;
  const busy = Number(pending?.n ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/zoeken" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-brand-strong">
        <ChevronLeft className="size-4" /> Terug naar zoeken
      </Link>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1 basis-[420px]">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              {org.type === "kerk" ? "Kerk" : "Goed doel"}
              {org.denomination ? ` · ${org.denomination}` : ""}
            </Badge>
            <StatusBadge status={busy ? "bezig" : org.enrichment_status} enrichedAt={org.enriched_at} />
            {org.blocked_at ? <Badge variant="destructive">Vergeten op {formatDate(org.blocked_at)}</Badge> : null}
          </div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">{org.name}</h1>
          <p className="text-muted-foreground">
            {[org.place, org.province].filter(Boolean).join(", ")}
            {org.website ? (
              <>
                {" · "}
                <a href={org.website} target="_blank" rel="noreferrer" className="text-navy-700 hover:text-brand-strong">
                  {org.website.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </>
            ) : null}
            {org.rsin ? ` · RSIN ${org.rsin}` : ""}
          </p>
        </div>
        <OrgActions org={{ id: org.id, blocked: !!org.blocked_at, busy, general_email: org.general_email, website: org.website }} roles={roles} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-1 basis-[560px] overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center gap-3">
            <CardTitle>Contactpersonen</CardTitle>
            <span className="text-sm text-muted-foreground">
              {contacts.length} gevonden, {usable} bruikbaar voor export
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2.5 text-left font-medium">Naam en rol</th>
                    <th className="px-3 py-2.5 text-left font-medium">E-mail</th>
                    <th className="px-3 py-2.5 text-left font-medium">Bron</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <ContactRow key={c.id} contact={c} roles={roles} />
                  ))}
                  {!contacts.length ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                        Nog geen contactpersonen. Start een verrijking of voeg er handmatig een toe.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-brand-strong" />
              Alleen gegevens die de organisatie zelf openbaar heeft gepubliceerd. Bron en datum gaan mee in elke export.
            </div>
          </CardContent>
        </Card>

        <aside className="flex w-full flex-col gap-4 md:w-[340px]">
          <Card>
            <CardHeader>
              <CardTitle>Algemeen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Field label="Algemeen e-mailadres">{org.general_email ?? "—"}</Field>
              <Field label="Postadres">{org.postal_address ?? "—"}</Field>
              {org.classis ? <Field label={org.type === "kerk" ? "Classis / regio" : "Sector"}>{org.classis}</Field> : null}
              <Field label="Bronlijst">{org.source_list ?? "—"}</Field>
              <Field label="KVK-nummer">{org.kvk_number ?? <span className="text-muted-foreground">Niet opgehaald</span>}</Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bronnen</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {sources.length ? (
                sources.map((s) => (
                  <div key={s.url} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.http_status === 200 ? "bg-success" : "bg-mist-300"}`} />
                    <div className="min-w-0">
                      <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-navy-700 hover:text-brand-strong">
                        <span className="truncate">{s.title || s.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {s.kind} · {formatDateTime(s.fetched_at)}
                        {s.http_status && s.http_status !== 200 ? ` · ${s.http_status}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Nog niets opgehaald.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historie</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              {exportsOf.map((e) => (
                <div key={e.name + e.created_at}>
                  <span className="text-muted-foreground">{formatDate(e.created_at)}</span> · in export &ldquo;{e.name}&rdquo;
                </div>
              ))}
              {changes.map((c, i) => (
                <div key={i}>
                  <span className="text-muted-foreground">{formatDate(c.changed_at)}</span> · {c.field.replace("contact:", "")} gewijzigd
                  {c.old_value ? `: ${c.old_value} → ${c.new_value}` : `: ${c.new_value}`}
                </div>
              ))}
              {!changes.length && !exportsOf.length ? <p className="text-muted-foreground">Nog geen wijzigingen.</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function StatusBadge({ status, enrichedAt }: { status: string; enrichedAt: string | null }) {
  if (status === "compleet") return <Badge variant="success">Verrijkt {daysAgo(enrichedAt)} geleden</Badge>;
  if (status === "controleren") return <Badge variant="warning">Te controleren</Badge>;
  if (status === "bezig") return <Badge variant="secondary">Verrijking loopt</Badge>;
  if (status === "niets_gevonden") return <Badge variant="secondary">Niets gevonden</Badge>;
  if (status === "fout") return <Badge variant="destructive">Verrijking mislukt</Badge>;
  return <Badge variant="secondary">Nog niet verrijkt</Badge>;
}
