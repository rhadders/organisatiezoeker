import "server-only";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

import { env } from "@/lib/env";

/*
 * Beleefd ophalen: één verzoek per seconde per host, robots.txt gerespecteerd,
 * een User-Agent met contactadres, time-out van 15 seconden.
 */
const lastHit = new Map<string, number>();
const robotsCache = new Map<string, { parser: ReturnType<typeof robotsParser> | null; at: number }>();
const MIN_GAP_MS = 1000;
const TIMEOUT_MS = 15_000;

export function userAgent() {
  return `Organisatiezoeker/1.0 (+mailto:${env.CRAWLER_CONTACT})`;
}

async function politeDelay(host: string) {
  const last = lastHit.get(host) ?? 0;
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

async function allowedByRobots(url: URL): Promise<boolean> {
  const origin = url.origin;
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < 6 * 3600_000) {
    return cached.parser ? (cached.parser.isAllowed(url.href, userAgent()) ?? true) : true;
  }
  let parser: ReturnType<typeof robotsParser> | null = null;
  try {
    await politeDelay(url.host);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (res.ok) parser = robotsParser(`${origin}/robots.txt`, await res.text());
  } catch {
    parser = null;
  }
  robotsCache.set(origin, { parser, at: Date.now() });
  return parser ? (parser.isAllowed(url.href, userAgent()) ?? true) : true;
}

export type Fetched = {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: Buffer;
};

export class FetchBlocked extends Error {}

export async function politeFetch(input: string): Promise<Fetched> {
  const url = new URL(input);
  if (!(await allowedByRobots(url))) throw new FetchBlocked(`robots.txt verbiedt ${url.href}`);
  await politeDelay(url.host);
  const res = await fetch(url.href, {
    headers: {
      "User-Agent": userAgent(),
      Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5",
      "Accept-Language": "nl,en;q=0.5",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    url: url.href,
    finalUrl: res.url || url.href,
    status: res.status,
    contentType: res.headers.get("content-type") ?? "",
    body: buf.subarray(0, 8 * 1024 * 1024),
  };
}

/** Platte tekst uit HTML: scripts, stijlen en navigatie eruit, witruimte genormaliseerd. */
export function htmlToText(html: string): { title: string; text: string; links: { href: string; text: string }[]; mailtos: string[] } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const mailtos = new Set<string>();
  const links: { href: string; text: string }[] = [];
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") ?? "").trim();
    const text = $(a).text().replace(/\s+/g, " ").trim();
    if (href.toLowerCase().startsWith("mailto:")) {
      const addr = href.slice(7).split("?")[0].trim().toLowerCase();
      if (addr) mailtos.add(addr);
    } else {
      links.push({ href, text });
    }
  });
  $("script, style, noscript, svg, iframe, template").remove();
  // Regeleinden bewaren op blokniveau, zodat "Scriba\nJ. de Vries" leesbaar blijft.
  $("br").replaceWith("\n");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, header, footer, dt, dd, td, th").each((_, el) => {
    $(el).append("\n");
  });
  const text = $("body")
    .text()
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text, links, mailtos: [...mailtos] };
}

/** Ook e-mailadressen die als tekst (niet als mailto) op de pagina staan. */
export function emailsInText(text: string): string[] {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))].filter(
    (e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e) && !e.includes("example."),
  );
}
