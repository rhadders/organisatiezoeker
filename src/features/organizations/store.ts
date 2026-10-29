import "server-only";

import { one, query } from "@/lib/db";
import { emailKind, normalizeEmail } from "@/features/contacts/email";

export type OrgInput = {
  type: "kerk" | "goed_doel";
  denomination: string;
  external_key: string;
  name: string;
  place?: string | null;
  province?: string | null;
  website?: string | null;
  classis?: string | null;
  rsin?: string | null;
  general_email?: string | null;
  postal_address?: string | null;
  source_list: string;
  source_url?: string | null;
};

const TRACKED: (keyof OrgInput)[] = ["name", "place", "province", "website", "classis", "rsin", "general_email", "postal_address", "source_url"];

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let w = raw.trim();
  if (!w) return null;
  if (!/^https?:\/\//i.test(w)) w = "https://" + w;
  try {
    const u = new URL(w);
    u.hash = "";
    return u.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Voegt toe of werkt bij op (denomination, external_key); logt gewijzigde velden. */
export async function upsertOrganization(input: OrgInput): Promise<{ id: string; created: boolean; changed: string[] }> {
  const existing = await one<Record<string, unknown> & { id: string; blocked_at: string | null }>(
    "select * from organizations where denomination = $1 and external_key = $2",
    [input.denomination, input.external_key],
  );
  const clean = {
    ...input,
    website: normalizeWebsite(input.website),
    general_email: normalizeEmail(input.general_email),
    place: input.place?.trim() || null,
    classis: input.classis?.trim() || null,
    rsin: input.rsin?.replace(/\D/g, "") || null,
    postal_address: input.postal_address?.trim() || null,
  };

  if (!existing) {
    const row = await one<{ id: string }>(
      `insert into organizations (type, denomination, external_key, name, place, province, website, classis, rsin,
         general_email, postal_address, source_list, source_url)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [clean.type, clean.denomination, clean.external_key, clean.name, clean.place, clean.province ?? null, clean.website,
        clean.classis, clean.rsin, clean.general_email, clean.postal_address, clean.source_list, clean.source_url ?? null],
    );
    return { id: row!.id, created: true, changed: [] };
  }

  const changed: string[] = [];
  for (const field of TRACKED) {
    const next = (clean as Record<string, unknown>)[field] ?? null;
    const prev = existing[field] ?? null;
    if (next !== null && next !== prev) changed.push(field);
  }
  if (changed.length) {
    const sets = changed.map((f, i) => `${f} = $${i + 2}`).join(", ");
    await query(`update organizations set ${sets} where id = $1`, [existing.id, ...changed.map((f) => (clean as Record<string, unknown>)[f])]);
    for (const f of changed) {
      await query(
        "insert into change_log (organization_id, field, old_value, new_value, source_url) values ($1,$2,$3,$4,$5)",
        [existing.id, f, existing[f] == null ? null : String(existing[f]), String((clean as Record<string, unknown>)[f]), clean.source_url ?? null],
      );
    }
  }
  return { id: existing.id, created: false, changed };
}

export type FoundContact = {
  role: string;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source_url: string;
  confidence: number;
  evidence?: string | null;
  reason?: string | null;
  origin: "bronlijst" | "extractie" | "handmatig";
};

/**
 * Voegt gevonden contacten samen met wat er al staat. Zelfde rol + zelfde
 * e-mail (of zelfde naam zonder e-mail) = dezelfde persoon: bijwerken. Een
 * nieuwe scriba met een ander adres vervangt de oude (is_current = false) en
 * komt in de wijzigingslog.
 */
export async function mergeContacts(orgId: string, found: FoundContact[]): Promise<{ added: number; updated: number; review: number }> {
  let added = 0, updated = 0, review = 0;
  const current = await query<{ id: string; role: string; email: string | null; display_name: string | null; status: string; origin: string; confidence: number }>(
    "select id, role, email, display_name, status, origin, confidence from contacts where organization_id = $1 and is_current",
    [orgId],
  );

  for (const f of found) {
    const email = normalizeEmail(f.email);
    const name = f.display_name?.replace(/\s+/g, " ").trim() || null;
    if (!email && !name) continue;
    const status = f.confidence >= 80 ? "zeker" : f.confidence >= 50 ? "te_controleren" : "verworpen";

    const same = current.find(
      (c) => c.role === f.role && ((email && c.email === email) || (!email && !c.email && name && c.display_name === name)),
    );
    if (same) {
      // Een afgekeurd contact blijft afgekeurd; anders de hoogste zekerheid houden.
      const keepStatus = same.status === "verworpen" ? "verworpen" : same.status === "zeker" ? "zeker" : status;
      await query(
        `update contacts set display_name = coalesce($2, display_name), phone = coalesce($3, phone), source_url = $4,
           seen_at = now(), confidence = greatest(confidence, $5), evidence = coalesce($6, evidence), reason = coalesce($7, reason), status = $8
         where id = $1`,
        [same.id, name, f.phone ?? null, f.source_url, f.confidence, f.evidence ?? null, f.reason ?? null, keepStatus],
      );
      updated++;
      continue;
    }

    // Zelfde rol, zeker, ander adres: de rol is van persoon gewisseld.
    const replaced = current.filter((c) => c.role === f.role && c.status === "zeker" && f.confidence >= 80 && f.role !== "algemeen");
    for (const r of replaced) {
      if (email && r.email && r.email !== email) {
        await query("update contacts set is_current = false where id = $1", [r.id]);
        await query(
          "insert into change_log (organization_id, field, old_value, new_value, source_url) values ($1,$2,$3,$4,$5)",
          [orgId, `contact:${f.role}`, [r.display_name, r.email].filter(Boolean).join(" · "), [name, email].filter(Boolean).join(" · "), f.source_url],
        );
      }
    }

    await query(
      `insert into contacts (organization_id, display_name, role, email, email_kind, phone, source_url, seen_at, confidence, status, evidence, reason, origin)
       values ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,$11,$12)`,
      [orgId, name, f.role, email, email ? emailKind(email) : null, f.phone ?? null, f.source_url, f.confidence, status, f.evidence ?? null, f.reason ?? null, f.origin],
    );
    added++;
    if (status === "te_controleren") review++;
  }
  return { added, updated, review };
}

export async function recordSource(orgId: string, kind: string, url: string, status: number | null, text: string | null, title: string | null) {
  const hash = text ? await sha256(text) : null;
  await query(
    `insert into sources (organization_id, kind, url, http_status, content_hash, content_text, title, fetched_at)
     values ($1,$2,$3,$4,$5,$6,$7,now())
     on conflict (organization_id, url) do update set http_status = excluded.http_status, content_hash = excluded.content_hash,
       content_text = excluded.content_text, title = excluded.title, fetched_at = now(), kind = excluded.kind`,
    [orgId, kind, url, status, hash, text ? text.slice(0, 200_000) : null, title],
  );
}

async function sha256(s: string) {
  const data = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}
