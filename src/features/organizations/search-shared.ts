/* Gedeeld tussen server en client: het filtermodel en de vertaling naar een querystring. */

export type SearchFilter = {
  q?: string;
  type?: "kerk" | "goed_doel" | "";
  denominations?: string[];
  provinces?: string[];
  roles?: string[];           // organisatie heeft een zeker contact met één van deze rollen
  hasEmail?: boolean;         // via de voorkeursvolgorde een bruikbaar e-mailadres
  verifiedDays?: number;      // contact gezien binnen n dagen
  notExportedDays?: number;   // niet in een export van de laatste n dagen
  statuses?: string[];        // enrichment_status
};

export const DEFAULT_PREFERENCE: Record<string, string[]> = {
  kerk: ["scriba", "kerkelijk_bureau", "algemeen"],
  goed_doel: ["fondsenwerving", "communicatie", "marketing", "directie", "algemeen"],
};

export function parseFilter(sp: Record<string, string | string[] | undefined>): SearchFilter {
  const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []).map((s) => s.trim()).filter(Boolean);
  const num = (v: string | string[] | undefined) => {
    const n = Number(Array.isArray(v) ? v[0] : v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    q: typeof sp.q === "string" ? sp.q.trim() : "",
    type: sp.type === "kerk" || sp.type === "goed_doel" ? sp.type : "",
    denominations: list(sp.denom),
    provinces: list(sp.prov),
    roles: list(sp.rol),
    hasEmail: sp.email === "1",
    verifiedDays: num(sp.ver),
    notExportedDays: num(sp.nexp),
    statuses: list(sp.status),
  };
}

export function filterToQuery(f: SearchFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type) p.set("type", f.type);
  if (f.denominations?.length) p.set("denom", f.denominations.join(","));
  if (f.provinces?.length) p.set("prov", f.provinces.join(","));
  if (f.roles?.length) p.set("rol", f.roles.join(","));
  if (f.hasEmail) p.set("email", "1");
  if (f.verifiedDays) p.set("ver", String(f.verifiedDays));
  if (f.notExportedDays) p.set("nexp", String(f.notExportedDays));
  if (f.statuses?.length) p.set("status", f.statuses.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}

