"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { enqueueSingle } from "@/features/enrichment/runs";
import { emailKind, normalizeEmail } from "@/features/contacts/email";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export type SimpleResult = { ok: true } | { ok: false; error: string };

async function audit(actor: string, action: string, subject: string, details?: unknown) {
  await query("insert into audit_log (actor, action, subject, details) values ($1,$2,$3,$4)", [actor, action, subject, details ? JSON.stringify(details) : null]);
}

export async function saveSelection(_prev: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Geef de selectie een naam." };
  let filter: unknown;
  try {
    filter = JSON.parse(String(formData.get("filter") ?? "{}"));
  } catch {
    return { ok: false, error: "De filters zijn niet leesbaar." };
  }
  await query("insert into saved_selections (name, filter_json) values ($1, $2)", [name, JSON.stringify(filter)]);
  revalidatePath("/zoeken");
  return { ok: true };
}

const statusSchema = z.object({
  contactId: z.string().uuid(),
  status: z.enum(["zeker", "te_controleren", "verworpen"]),
  role: z.string().min(1).optional(),
});

/** Klopt / andere rol / verwerp — de handmatige controle op een vondst. */
export async function setContactStatus(input: { contactId: string; status: "zeker" | "te_controleren" | "verworpen"; role?: string }): Promise<SimpleResult> {
  const { user } = await requireUser();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer." };
  const { contactId, status, role } = parsed.data;
  const row = await one<{ organization_id: string }>(
    `update contacts set status = $2, role = coalesce($3, role), confidence = case when $2 = 'zeker' then greatest(confidence, 100) else confidence end
     where id = $1 returning organization_id`,
    [contactId, status, role ?? null],
  );
  if (!row) return { ok: false, error: "Contact niet gevonden." };
  await recomputeStatus(row.organization_id);
  await audit(user.email ?? "", "contact_status", contactId, { status, role });
  revalidatePath(`/organisaties/${row.organization_id}`);
  revalidatePath("/verrijking");
  return { ok: true };
}

const contactSchema = z.object({
  organizationId: z.string().uuid(),
  display_name: z.string().trim().max(200).optional(),
  role: z.string().min(1),
  email: z.string().trim().optional(),
  phone: z.string().trim().max(40).optional(),
  source_url: z.string().trim().optional(),
});

export async function addContact(_prev: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const { user } = await requireUser();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Controleer de invoer." };
  const d = parsed.data;
  const email = normalizeEmail(d.email);
  if (d.email && !email) return { ok: false, error: "Het e-mailadres is niet geldig." };
  if (!email && !d.display_name) return { ok: false, error: "Vul minstens een naam of een e-mailadres in." };
  await query(
    `insert into contacts (organization_id, display_name, role, email, email_kind, phone, source_url, seen_at, confidence, status, origin, evidence)
     values ($1,$2,$3,$4,$5,$6,$7,now(),100,'zeker','handmatig','Handmatig toegevoegd')`,
    [d.organizationId, d.display_name || null, d.role, email, email ? emailKind(email) : null, d.phone || null, d.source_url || null],
  );
  await recomputeStatus(d.organizationId);
  await audit(user.email ?? "", "contact_toegevoegd", d.organizationId);
  revalidatePath(`/organisaties/${d.organizationId}`);
  return { ok: true };
}

export async function removeContact(contactId: string): Promise<SimpleResult> {
  const { user } = await requireUser();
  const row = await one<{ organization_id: string }>("update contacts set is_current = false where id = $1 returning organization_id", [contactId]);
  if (!row) return { ok: false, error: "Contact niet gevonden." };
  await recomputeStatus(row.organization_id);
  await audit(user.email ?? "", "contact_verwijderd", contactId);
  revalidatePath(`/organisaties/${row.organization_id}`);
  return { ok: true };
}

export async function refetchOrganization(organizationId: string): Promise<SimpleResult> {
  const { user } = await requireUser();
  await enqueueSingle(organizationId);
  await audit(user.email ?? "", "verrijking_aangevraagd", organizationId);
  revalidatePath(`/organisaties/${organizationId}`);
  return { ok: true };
}

/** "Vergeet deze organisatie": contacten weg, blokkade voor de toekomst. */
export async function forgetOrganization(organizationId: string): Promise<SimpleResult> {
  const { user } = await requireUser();
  await query("delete from contacts where organization_id = $1", [organizationId]);
  await query("delete from sources where organization_id = $1", [organizationId]);
  await query("update organizations set blocked_at = now(), general_email = null, enrichment_status = 'nieuw' where id = $1", [organizationId]);
  await query("update jobs set status = 'overgeslagen' where organization_id = $1 and status in ('wachtrij','bezig')", [organizationId]);
  await audit(user.email ?? "", "organisatie_vergeten", organizationId);
  revalidatePath(`/organisaties/${organizationId}`);
  revalidatePath("/zoeken");
  return { ok: true };
}

export async function unblockOrganization(organizationId: string): Promise<SimpleResult> {
  const { user } = await requireUser();
  await query("update organizations set blocked_at = null where id = $1", [organizationId]);
  await audit(user.email ?? "", "blokkade_opgeheven", organizationId);
  revalidatePath(`/organisaties/${organizationId}`);
  return { ok: true };
}

const orgSchema = z.object({
  organizationId: z.string().uuid(),
  general_email: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

export async function updateOrganization(_prev: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const { user } = await requireUser();
  const parsed = orgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Controleer de invoer." };
  const email = parsed.data.general_email ? normalizeEmail(parsed.data.general_email) : null;
  if (parsed.data.general_email && !email) return { ok: false, error: "Het e-mailadres is niet geldig." };
  const website = parsed.data.website ? (parsed.data.website.startsWith("http") ? parsed.data.website : `https://${parsed.data.website}`) : null;
  await query("update organizations set general_email = $2, website = coalesce($3, website) where id = $1", [parsed.data.organizationId, email, website]);
  await audit(user.email ?? "", "organisatie_bewerkt", parsed.data.organizationId);
  revalidatePath(`/organisaties/${parsed.data.organizationId}`);
  return { ok: true };
}

async function recomputeStatus(orgId: string) {
  await query(
    `update organizations o set enrichment_status = s.status from (
       select case
         when count(*) filter (where status = 'te_controleren') > 0 then 'controleren'
         when count(*) filter (where status = 'zeker' and email is not null) > 0 then 'compleet'
         when o2.enrichment_status = 'nieuw' then 'nieuw'
         else 'niets_gevonden' end as status
       from organizations o2 left join contacts c on c.organization_id = o2.id and c.is_current
       where o2.id = $1 group by o2.enrichment_status) s
     where o.id = $1`,
    [orgId],
  );
}
