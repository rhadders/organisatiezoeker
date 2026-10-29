import "server-only";

import { emailsInText, htmlToText, politeFetch, FetchBlocked } from "@/features/crawl/fetch";
import { pdfToText } from "@/features/crawl/pdf";
import { emailKind, normalizeEmail, roleFromEmail } from "@/features/contacts/email";
import { parseKoepelDetail } from "@/features/import/denominations";
import { mergeContacts, normalizeWebsite, recordSource, type FoundContact } from "@/features/organizations/store";
import { one, query } from "@/lib/db";

import { extractContacts, type PageText } from "./extract";

type Org = {
  id: string; type: "kerk" | "goed_doel"; name: string; place: string | null; website: string | null;
  source_url: string | null; denomination: string | null; general_email: string | null; blocked_at: string | null;
  postal_address: string | null; classis: string | null;
};

const CANDIDATE_WORDS = [
  ["contact", 10], ["anbi", 9], ["kerkenraad", 8], ["scriba", 8], ["kerkelijk-bureau", 8], ["kerkelijkbureau", 8],
  ["organisatie", 7], ["bestuur", 7], ["over-ons", 6], ["over", 4], ["wie-zijn-wij", 6], ["gemeente", 5],
  ["adressen", 7], ["colofon", 5], ["team", 6], ["medewerkers", 6], ["pers", 5], ["communicatie", 6],
  ["fondsenwerving", 7], ["diaconie", 4], ["predikant", 4], ["jeugd", 2], ["kerkblad", 4],
] as const;
const MAX_PAGES = 8;

export type EnrichResult = { status: string; added: number; review: number; pages: number };

export async function enrichOrganization(orgId: string): Promise<EnrichResult> {
  const org = await one<Org>("select * from organizations where id = $1", [orgId]);
  if (!org) throw new Error("Organisatie bestaat niet");
  if (org.blocked_at) return { status: "geblokkeerd", added: 0, review: 0, pages: 0 };

  await query("update organizations set enrichment_status = 'bezig' where id = $1", [orgId]);
  const found: FoundContact[] = [];
  const pages: (PageText & { mailtos?: string[] })[] = [];

  // 1. Detailpagina van het kerkverband: gestructureerd, zonder taalmodel.
  if (org.source_url) {
    try {
      const res = await politeFetch(org.source_url);
      if (res.status === 200 && /html/i.test(res.contentType)) {
        const html = res.body.toString("utf8");
        const detail = parseKoepelDetail(org.source_url, html);
        const { text, title } = htmlToText(html);
        await recordSource(orgId, "koepel", org.source_url, res.status, text, title);
        if (detail) {
          found.push(...detail.contacts);
          const website = normalizeWebsite(detail.website);
          const updates: string[] = [];
          const params: unknown[] = [orgId];
          if (website && website !== org.website) { params.push(website); updates.push(`website = $${params.length}`); org.website = website; }
          if (detail.postal_address && !org.postal_address) { params.push(detail.postal_address); updates.push(`postal_address = $${params.length}`); }
          if (detail.classis && !org.classis) { params.push(detail.classis); updates.push(`classis = $${params.length}`); }
          if (updates.length) await query(`update organizations set ${updates.join(", ")} where id = $1`, params);
        }
      }
    } catch (err) {
      if (!(err instanceof FetchBlocked)) await recordSource(orgId, "koepel", org.source_url, null, null, null);
    }
  }

  // 2. De eigen website: homepage plus hooguit acht kandidaatpagina's.
  if (org.website) {
    const home = await fetchPage(orgId, org.website, "website");
    if (home) {
      pages.push(home.page);
      const candidates = pickCandidates(org.website, home.links);
      for (const url of candidates) {
        const kind = /anbi/i.test(url) ? "anbi" : /contact/i.test(url) ? "contact" : "pagina";
        const p = await fetchPage(orgId, url, kind);
        if (p) pages.push(p.page);
      }
    }
    // E-mailadressen die letterlijk op de pagina's staan, met een rol uit het local-part.
    const seenEmails = new Set<string>();
    for (const p of pages) {
      for (const raw of [...(p.mailtos ?? []), ...emailsInText(p.text)]) {
        const email = normalizeEmail(raw);
        if (!email || seenEmails.has(email)) continue;
        if (!sameOrganizationDomain(email, org.website)) continue;
        seenEmails.add(email);
        const role = roleFromEmail(email);
        if (!role) continue;
        found.push({
          role, email, source_url: p.url, origin: "extractie",
          confidence: role === "algemeen" ? 95 : emailKind(email) === "functioneel" ? 90 : 60,
          evidence: `E-mailadres op de pagina: ${email}`,
          reason: "Rol afgeleid uit het e-mailadres zelf",
        });
      }
    }
  }

  // 3. Taalmodel over de platte tekst: namen bij rollen, twijfelgevallen gescoord.
  if (pages.length) {
    const roles = await query<{ key: string; label: string }>(
      "select key, label from roles where applies_to = 'beide' or applies_to = $1 order by sort_order",
      [org.type],
    );
    try {
      const extracted = await extractContacts(org, roles, pages);
      for (const c of extracted) {
        const email = normalizeEmail(c.email);
        if (email && !sameOrganizationDomain(email, org.website) && c.rol !== "algemeen") c.zekerheid = Math.min(c.zekerheid, 60);
        found.push({
          role: c.rol, display_name: c.naam, email, phone: c.telefoon, source_url: pages[0].url,
          confidence: Math.max(0, Math.min(100, Math.round(c.zekerheid))), evidence: c.citaat?.slice(0, 200) ?? null,
          reason: c.toelichting?.slice(0, 300) ?? null, origin: "extractie",
        });
      }
    } catch (err) {
      await query("insert into audit_log (actor, action, subject, details) values ('worker','extractie_mislukt',$1,$2)", [
        orgId, JSON.stringify({ message: err instanceof Error ? err.message : String(err) }),
      ]);
    }
  }

  // Ontdubbelen: hoogste zekerheid per (rol, e-mail/naam) wint; een naam bij een
  // adres dat ook zonder naam is gezien, vult dat adres aan.
  const unique = dedupe(found);
  const merged = await mergeContacts(orgId, unique);

  // Algemeen adres op de organisatie zetten als dat nog leeg is.
  const general = unique.find((f) => f.role === "algemeen" && f.email);
  if (general && !org.general_email) {
    await query("update organizations set general_email = $2 where id = $1", [orgId, general.email]);
  }

  const summary = await one<{ zeker: number; review: number }>(
    `select count(*) filter (where status = 'zeker' and email is not null) as zeker,
            count(*) filter (where status = 'te_controleren') as review
     from contacts where organization_id = $1 and is_current`,
    [orgId],
  );
  const status =
    Number(summary?.review ?? 0) > 0 ? "controleren" :
    Number(summary?.zeker ?? 0) > 0 ? "compleet" : "niets_gevonden";
  await query("update organizations set enrichment_status = $2, enriched_at = now() where id = $1", [orgId, status]);
  return { status, added: merged.added, review: merged.review, pages: pages.length };
}

function dedupe(found: FoundContact[]): FoundContact[] {
  const byKey = new Map<string, FoundContact>();
  for (const f of found) {
    const email = normalizeEmail(f.email);
    const key = `${f.role}|${email ?? (f.display_name ?? "").toLowerCase()}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...f, email });
      continue;
    }
    byKey.set(key, {
      ...prev,
      display_name: prev.display_name ?? f.display_name,
      phone: prev.phone ?? f.phone,
      confidence: Math.max(prev.confidence, f.confidence),
      evidence: prev.evidence ?? f.evidence,
      reason: prev.reason ?? f.reason,
      origin: prev.origin === "bronlijst" ? "bronlijst" : f.origin,
    });
  }
  // Een naam uit het taalmodel bij een functioneel adres dat al zonder naam bekend is.
  const result = [...byKey.values()];
  for (const r of result) {
    if (r.display_name || !r.email) continue;
    const named = found.find((f) => f.role === r.role && normalizeEmail(f.email) === r.email && f.display_name);
    if (named) r.display_name = named.display_name;
  }
  return result;
}

function sameOrganizationDomain(email: string, website: string | null): boolean {
  if (!website) return true;
  try {
    const host = new URL(website).host.replace(/^www\./, "");
    const domain = email.split("@")[1];
    const base = (h: string) => h.split(".").slice(-2).join(".");
    return base(domain) === base(host) || /gmail|hotmail|outlook|live|kpnmail|ziggo|planet|solcon|filternet|kliksafe|hetnet|xs4all|icloud|me\.com|quicknet|telfort|upcmail|chello/.test(domain);
  } catch {
    return true;
  }
}

async function fetchPage(orgId: string, url: string, kind: string): Promise<{ page: PageText & { mailtos: string[] }; links: { href: string; text: string }[] } | null> {
  try {
    const res = await politeFetch(url);
    if (res.status !== 200) {
      await recordSource(orgId, kind, url, res.status, null, null);
      return null;
    }
    if (/pdf/i.test(res.contentType) || /\.pdf($|\?)/i.test(res.finalUrl)) {
      const text = await pdfToText(res.body);
      await recordSource(orgId, "pdf", url, res.status, text, null);
      return { page: { url, title: null, text, mailtos: [] }, links: [] };
    }
    if (!/html/i.test(res.contentType)) return null;
    const { title, text, links, mailtos } = htmlToText(res.body.toString("utf8"));
    await recordSource(orgId, kind, url, res.status, text, title);
    const base = res.finalUrl || url;
    const absolute = links
      .map((l) => {
        try {
          return { href: new URL(l.href, base).href, text: l.text };
        } catch {
          return null;
        }
      })
      .filter((l): l is { href: string; text: string } => !!l);
    return { page: { url, title, text, mailtos }, links: absolute };
  } catch {
    await recordSource(orgId, kind, url, null, null, null);
    return null;
  }
}

export function pickCandidates(website: string, links: { href: string; text: string }[]): string[] {
  let host: string;
  try {
    host = new URL(website).host.replace(/^www\./, "");
  } catch {
    return [];
  }
  const scored = new Map<string, number>();
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    if (u.host.replace(/^www\./, "") !== host) continue;
    if (/\.(jpg|jpeg|png|gif|svg|webp|mp3|mp4|zip|docx?|xlsx?|pptx?)($|\?)/i.test(u.pathname)) continue;
    u.hash = "";
    const hay = `${u.pathname.toLowerCase()} ${l.text.toLowerCase()}`;
    let score = 0;
    for (const [word, weight] of CANDIDATE_WORDS) if (hay.includes(word)) score += weight;
    if (/\.pdf($|\?)/i.test(u.pathname) && /anbi|jaarverslag|publicatieplicht/i.test(hay)) score += 6;
    if (u.pathname.split("/").filter(Boolean).length > 3) score -= 2;
    if (score <= 0) continue;
    const key = u.href.replace(/\/$/, "");
    if (key === website.replace(/\/$/, "")) continue;
    scored.set(key, Math.max(scored.get(key) ?? 0, score));
  }
  return [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_PAGES).map(([u]) => u);
}
