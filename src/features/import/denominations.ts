import "server-only";
import * as cheerio from "cheerio";

import { politeFetch, htmlToText } from "@/features/crawl/fetch";
import { normalizeEmail, roleFromEmail } from "@/features/contacts/email";
import { provinceFromPostcode } from "@/features/organizations/province";
import { mergeContacts, upsertOrganization, type FoundContact } from "@/features/organizations/store";
import { query } from "@/lib/db";

export const DENOMINATIONS: Record<string, { label: string; listUrl: string }> = {
  PKN: { label: "Protestantse Kerk in Nederland", listUrl: "https://protestantsekerk.nl/kerkzoeker/?json" },
  CGK: { label: "Christelijke Gereformeerde Kerken", listUrl: "https://cgk.nl/kerken-en-predikanten/" },
  NGK: { label: "Nederlandse Gereformeerde Kerken", listUrl: "https://ngk.nl/kerken/" },
  HHK: { label: "Hersteld Hervormde Kerk", listUrl: "https://www.hersteldhervormdekerk.nl/gemeenten" },
};

export type ImportReport = { denomination: string; seen: number; created: number; updated: number; contacts: number; notes: string[] };

export async function importDenomination(code: string, log: (m: string) => void = () => {}): Promise<ImportReport> {
  switch (code) {
    case "PKN":
      return importPkn(log);
    case "CGK":
      return importCgk(log);
    case "NGK":
      return importNgk(log);
    case "HHK":
      return importHhk(log);
    default:
      throw new Error(`Onbekend kerkverband: ${code}`);
  }
}

function placeFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const m = addr.match(/\d{4}\s?[A-Z]{2}\s+(.+)$/im);
  return m ? titleCase(m[1].trim()) : null;
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((p) => (p.length > 1 && p !== "aan" && p !== "den" && p !== "de" && p !== "op" && p !== "en" && p !== "van" ? p[0].toUpperCase() + p.slice(1) : p))
    .join("")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bGld\b/i, "")
    .trim();
}

/* ------------------------------------------------------------------ PKN */
async function importPkn(log: (m: string) => void): Promise<ImportReport> {
  const res = await politeFetch(DENOMINATIONS.PKN.listUrl);
  if (res.status !== 200) throw new Error(`PKN-feed gaf ${res.status}`);
  const data = JSON.parse(res.body.toString("utf8")) as { churches: PknChurch[] };
  const report: ImportReport = { denomination: "PKN", seen: 0, created: 0, updated: 0, contacts: 0, notes: [] };
  let skipped = 0;
  for (const c of data.churches) {
    const kinds = c.denomination ?? [];
    // Pioniersplekken en kerken in het buitenland horen niet in versie 1.
    if (!kinds.includes("protestantse-kerk")) {
      skipped++;
      continue;
    }
    report.seen++;
    const address = [c.address, [c.zipcode, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const r = await upsertOrganization({
      type: "kerk",
      denomination: "PKN",
      external_key: String(c.id),
      name: decodeEntities(c.congregation).trim(),
      place: decodeEntities(c.city).trim() || null,
      province: provinceFromPostcode(c.zipcode),
      website: c.website,
      classis: c.classis,
      postal_address: address || null,
      source_list: "protestantsekerk.nl kerkzoeker",
      source_url: c.url ? `https://protestantsekerk.nl${c.url}` : null,
    });
    if (r.created) report.created++;
    else if (r.changed.length) report.updated++;
  }
  report.notes.push(`${skipped} pioniersplekken/buitenland overgeslagen`);
  log(`PKN: ${report.seen} gemeenten, ${report.created} nieuw`);
  return report;
}

type PknChurch = {
  id: string; url: string; congregation: string; address: string; zipcode: string; city: string;
  website: string; classis: string | null; denomination: string[];
};

function decodeEntities(s: string) {
  return cheerio.load(`<p>${s}</p>`)("p").text();
}

/* ------------------------------------------------------------------ CGK */
export type CgkRecord = {
  external_key: string; place: string; rsin: string | null; classis: string | null; website: string | null;
  detail_url: string | null; address: string | null; contacts: { roleLabel: string; name: string | null; email: string | null; phone: string | null; evidence: string }[];
  diaconie_email: string | null;
};

/** Pure parser van de CGK-lijst (kerken en predikanten): alles staat op één pagina. */
export function parseCgkList(html: string): CgkRecord[] {
  const $ = cheerio.load(html);
  const records: CgkRecord[] = [];
  for (const el of $("article.community").toArray()) {
    const art = $(el);
    const idMatch = (art.attr("id") ?? art.attr("class") ?? "").match(/post-(\d+)/);
    if (!idMatch) continue;
    const title = art.find(".post__content-title .o-layout__item").first().clone();
    title.find("span").remove();
    const place = title.text().replace(/\s+/g, " ").trim();
    const rsin = art.find(".rsin").clone();
    rsin.find("span").remove();
    const fields: Record<string, string> = {};
    art.find("p.table").each((_, p) => {
      const label = $(p).find("span").first().text().replace(":", "").trim().toLowerCase();
      const value = $(p).clone().children("span").remove().end().text().replace(/\s+/g, " ").trim();
      if (label && !(label in fields)) fields[label] = value;
    });
    const contacts: CgkRecord["contacts"] = [];
    art.find(".person22").each((_, p) => {
      const block = $(p);
      const roleLabel = block.find("b").first().text().trim();
      const paras = block.find("p").toArray().map((x) => $(x).text().replace(/\s+/g, " ").trim()).filter(Boolean);
      const email = normalizeEmail(block.find("a[href^='mailto:']").first().attr("href"));
      const phone = paras.find((t) => /^[\d\s()+-]{8,}$/.test(t)) ?? null;
      const name = paras.find((t) => t && t.toLowerCase() !== roleLabel.toLowerCase() && !/\d/.test(t) && !t.includes("@")) ?? null;
      contacts.push({ roleLabel, name, email, phone, evidence: `${roleLabel}: ${paras.join(" · ")}`.slice(0, 200) });
    });
    const diaconieHeading = art.find("h4").filter((_, h) => $(h).text().trim().toLowerCase() === "diaconie").first();
    const diaconie_email = normalizeEmail(diaconieHeading.nextAll().find("a[href^='mailto:']").first().attr("href"));
    records.push({
      external_key: idMatch[1],
      place,
      rsin: rsin.text().trim() || null,
      classis: fields["behoort tot de classis"] ?? null,
      website: art.find("p.table a[target=_blank]").first().attr("href") ?? null,
      detail_url: art.find("a.button").first().attr("href") ?? null,
      address: fields["adres"] ?? null,
      contacts,
      diaconie_email,
    });
  }
  return records;
}

async function importCgk(log: (m: string) => void): Promise<ImportReport> {
  const res = await politeFetch(DENOMINATIONS.CGK.listUrl);
  if (res.status !== 200) throw new Error(`CGK-lijst gaf ${res.status}`);
  const report: ImportReport = { denomination: "CGK", seen: 0, created: 0, updated: 0, contacts: 0, notes: [] };
  for (const rec of parseCgkList(res.body.toString("utf8"))) {
    report.seen++;
    const org = await upsertOrganization({
      type: "kerk",
      denomination: "CGK",
      external_key: rec.external_key,
      name: `CGK ${rec.place}`,
      place: rec.place,
      province: provinceFromPostcode(rec.address),
      website: rec.website,
      classis: rec.classis,
      rsin: rec.rsin,
      postal_address: rec.address,
      source_list: "cgk.nl kerken en predikanten",
      source_url: rec.detail_url,
    });
    if (org.created) report.created++;
    else if (org.changed.length) report.updated++;

    const sourceUrl = rec.detail_url ?? DENOMINATIONS.CGK.listUrl;
    const found: FoundContact[] = [];
    for (const c of rec.contacts) {
      const role = mapCgkRole(c.roleLabel) ?? (c.email ? roleFromEmail(c.email) : null);
      if (!role) continue;
      found.push({ role, display_name: c.name, email: c.email, phone: c.phone, source_url: sourceUrl, confidence: 100, origin: "bronlijst", evidence: c.evidence });
    }
    if (rec.diaconie_email) found.push({ role: "diaconie", email: rec.diaconie_email, source_url: sourceUrl, confidence: 100, origin: "bronlijst" });
    const merged = await mergeContacts(org.id, found);
    report.contacts += merged.added;
    if (found.some((f) => f.role === "scriba" || f.role === "kerkelijk_bureau")) await markEnriched(org.id, "compleet");
  }
  log(`CGK: ${report.seen} gemeenten, ${report.created} nieuw, ${report.contacts} contacten`);
  return report;
}

function mapCgkRole(label: string): string | null {
  const l = label.toLowerCase();
  if (l.includes("scriba")) return "scriba";
  if (l.includes("kerkelijk bureau") || l.includes("kerk. bur") || l.includes("secretar")) return "kerkelijk_bureau";
  if (l.includes("diacon")) return "diaconie";
  if (l.includes("gemeenteblad") || l.includes("redactie") || l.includes("kerkblad") || l.includes("communicatie")) return "communicatie";
  if (l.includes("jeugd")) return "jeugdwerk";
  if (l.includes("penningmeester")) return "kerkrentmeesters";
  if (l.includes("koster") || l.includes("preekvoorziener")) return null; // niet relevant voor benadering
  return null;
}

/* ------------------------------------------------------------------ NGK */
async function importNgk(log: (m: string) => void): Promise<ImportReport> {
  const report: ImportReport = { denomination: "NGK", seen: 0, created: 0, updated: 0, contacts: 0, notes: [] };
  const seen = new Set<string>();
  for (let page = 1; page <= 60; page++) {
    const url = page === 1 ? DENOMINATIONS.NGK.listUrl : `https://ngk.nl/kerken/page/${page}/`;
    const res = await politeFetch(url);
    if (res.status === 404) break;
    if (res.status !== 200) throw new Error(`NGK-lijst pagina ${page} gaf ${res.status}`);
    const $ = cheerio.load(res.body.toString("utf8"));
    const items = $("a.library-item").toArray();
    if (!items.length) break;
    let newOnPage = 0;
    for (const a of items) {
      const href = $(a).attr("href") ?? "";
      const name = $(a).find(".library-item__title").text().replace(/\s+/g, " ").trim();
      const key = href.replace(/\/$/, "").split("/").pop() ?? "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      newOnPage++;
      report.seen++;
      const place = name.replace(/^NGK\s+/i, "").trim();
      const org = await upsertOrganization({
        type: "kerk",
        denomination: "NGK",
        external_key: key,
        name,
        place,
        source_list: "ngk.nl kerken",
        source_url: href,
      });
      if (org.created) report.created++;
      else if (org.changed.length) report.updated++;
    }
    if (!newOnPage) break;
  }
  report.notes.push("Website, adres en e-mail van scriba komen van de detailpagina tijdens de verrijking");
  log(`NGK: ${report.seen} kerken, ${report.created} nieuw`);
  return report;
}

/* ------------------------------------------------------------------ HHK */
export type HhkRecord = { external_key: string; name: string; href: string; address: string | null; phone: string | null };

export function parseHhkList(html: string): HhkRecord[] {
  const $ = cheerio.load(html);
  const out: HhkRecord[] = [];
  for (const el of $("div.item").toArray()) {
    const a = $(el).find("h2 a").first();
    const href = a.attr("href");
    const name = a.text().replace(/\s+/g, " ").trim();
    if (!href || !name) continue;
    const key = href.replace(/\/$/, "").split("/").pop() ?? "";
    const p = $(el).find("p").first().text().replace(/\s+/g, " ").trim();
    const phone = p.match(/(\d{2,4}[- ]\d{6,8})\s*$/)?.[1] ?? null;
    const address = (phone ? p.replace(phone, "") : p).trim() || null;
    out.push({ external_key: key, name, href: href.startsWith("http") ? href : `https://www.hersteldhervormdekerk.nl${href}`, address, phone });
  }
  return out;
}

async function importHhk(log: (m: string) => void): Promise<ImportReport> {
  const res = await politeFetch(DENOMINATIONS.HHK.listUrl);
  if (res.status !== 200) throw new Error(`HHK-lijst gaf ${res.status}`);
  const report: ImportReport = { denomination: "HHK", seen: 0, created: 0, updated: 0, contacts: 0, notes: [] };
  for (const rec of parseHhkList(res.body.toString("utf8"))) {
    report.seen++;
    const org = await upsertOrganization({
      type: "kerk",
      denomination: "HHK",
      external_key: rec.external_key,
      name: rec.name,
      place: placeFromAddress(rec.address) ?? rec.name.replace(/^Hersteld Hervormde gemeente\s+/i, ""),
      province: provinceFromPostcode(rec.address),
      postal_address: rec.address,
      source_list: "hersteldhervormdekerk.nl gemeenten",
      source_url: rec.href,
    });
    if (org.created) report.created++;
    else if (org.changed.length) report.updated++;
  }
  report.notes.push("Website en scriba (naam, adres, telefoon) komen van de detailpagina tijdens de verrijking");
  log(`HHK: ${report.seen} gemeenten, ${report.created} nieuw`);
  return report;
}

async function markEnriched(orgId: string, status: string) {
  await query("update organizations set enrichment_status = $2, enriched_at = now() where id = $1 and enrichment_status in ('nieuw','compleet')", [orgId, status]);
}

/* -------------------------------------------- detailpagina's van koepels */
export type KoepelDetail = {
  website?: string | null;
  postal_address?: string | null;
  classis?: string | null;
  contacts: FoundContact[];
};

/** Structurele parser voor de detailpagina van een kerkverband; null als de host onbekend is. */
export function parseKoepelDetail(url: string, html: string): KoepelDetail | null {
  const host = new URL(url).host.replace(/^www\./, "");
  if (host === "ngk.nl") return parseNgkDetail(url, html);
  if (host === "hersteldhervormdekerk.nl") return parseHhkDetail(url, html);
  return null;
}

function parseNgkDetail(url: string, html: string): KoepelDetail {
  const { text } = htmlToText(html);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const value = (label: RegExp, span = 2) => {
    const i = lines.findIndex((l) => label.test(l));
    return i >= 0 ? lines.slice(i + 1, i + 1 + span).filter((l) => !/^(E-mail|Adres|Postadres|Naam regio|Website|Algemeen|Rolstoel|Ringleiding|1e dienst|Doopleden|Belijdende)/i.test(l)) : [];
  };
  const website = value(/^Websiteadres kerk$/i, 1)[0] ?? null;
  const postal = value(/^Postadres$/i, 2).join(", ") || value(/^Adres kerkgebouw$/i, 2).join(", ") || null;
  const classis = value(/^Naam regio$/i, 1)[0] ?? null;
  const contacts: FoundContact[] = [];
  lines.forEach((l, i) => {
    const m = l.match(/^E-mail\s+(.+)$/i);
    if (!m) return;
    const email = normalizeEmail(lines[i + 1]);
    if (!email) return;
    const label = m[1].toLowerCase();
    const role =
      label.includes("scriba") ? "scriba" :
      label.includes("kerkelijk bureau") || label.includes("secretar") ? "kerkelijk_bureau" :
      label.includes("diacon") ? "diaconie" :
      label.includes("voorzitter") ? "voorzitter" :
      label.includes("predikant") ? "predikant" :
      label.includes("jeugd") ? "jeugdwerk" :
      label.includes("kerkblad") || label.includes("communicatie") || label.includes("redactie") ? "communicatie" :
      label.includes("penningmeester") || label.includes("beheer") ? "kerkrentmeesters" : null;
    if (!role) return;
    contacts.push({ role, email, source_url: url, confidence: 100, origin: "bronlijst", evidence: `${l}: ${email}` });
  });
  return { website, postal_address: postal, classis, contacts };
}

function parseHhkDetail(url: string, html: string): KoepelDetail {
  const { text } = htmlToText(html);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const after = (label: RegExp) => lines.find((l) => label.test(l))?.replace(label, "").trim() ?? null;
  const website = after(/^Website:\s*/i);
  const addr = after(/^Adres:\s*/i);
  const contacts: FoundContact[] = [];
  const si = lines.findIndex((l) => /^Scriba$/i.test(l));
  if (si >= 0) {
    const block = lines.slice(si + 1, si + 6);
    const name = block.find((l) => /^Naam:/i.test(l))?.replace(/^Naam:\s*/i, "") ?? null;
    const phone = block.find((l) => /^Telefoonnummer:/i.test(l))?.replace(/^Telefoonnummer:\s*/i, "") ?? null;
    const email = normalizeEmail(block.find((l) => l.includes("@"))?.replace(/^E-?mail(adres)?:\s*/i, "") ?? null);
    if (name || email) {
      contacts.push({ role: "scriba", display_name: name, email, phone, source_url: url, confidence: 100, origin: "bronlijst", evidence: block.join(" · ").slice(0, 200) });
    }
  }
  const predikant = after(/^Predikant[^:]*:\s*/i);
  if (predikant) {
    contacts.push({ role: "predikant", display_name: predikant, source_url: url, confidence: 90, origin: "bronlijst" });
  }
  return { website: website && /^https?:\/\//i.test(website) ? website : website ? `http://${website}` : null, postal_address: addr, contacts };
}
