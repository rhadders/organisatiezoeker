import "server-only";

import { one, query } from "@/lib/db";

import { DEFAULT_PREFERENCE, type SearchFilter } from "./search-shared";

export { DEFAULT_PREFERENCE, filterToQuery, parseFilter, type SearchFilter } from "./search-shared";

/** WHERE-clausule op alias o; parameters beginnen bij $1. */
export function buildWhere(f: SearchFilter, preference: string[] = []): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where: string[] = ["true"];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.type) where.push(`o.type = ${add(f.type)}`);
  if (f.denominations?.length) where.push(`o.denomination = any(${add(f.denominations)}::text[])`);
  if (f.provinces?.length) where.push(`o.province = any(${add(f.provinces)}::text[])`);
  if (f.statuses?.length) where.push(`o.enrichment_status = any(${add(f.statuses)}::text[])`);
  if (f.q) {
    const q = add(`%${f.q}%`);
    where.push(`(o.name ilike ${q} or o.place ilike ${q} or o.website ilike ${q} or o.classis ilike ${q})`);
  }
  if (f.roles?.length) {
    where.push(
      `exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.role = any(${add(f.roles)}::text[]))`,
    );
  }
  if (f.hasEmail) {
    const prefs = preference.length ? preference : ["scriba", "kerkelijk_bureau", "fondsenwerving", "communicatie", "marketing", "directie", "algemeen"];
    where.push(
      `(o.general_email is not null or exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.email is not null and c.role = any(${add(prefs)}::text[])))`,
    );
  }
  if (f.verifiedDays) {
    where.push(
      `exists (select 1 from contacts c where c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.seen_at >= now() - (${add(f.verifiedDays)} || ' days')::interval)`,
    );
  }
  if (f.notExportedDays) {
    where.push(
      `not exists (select 1 from export_rows er join exports e on e.id = er.export_id where er.organization_id = o.id and e.created_at >= now() - (${add(f.notExportedDays)} || ' days')::interval)`,
    );
  }
  return { sql: where.join(" and "), params };
}

export type ResultRow = {
  id: string; name: string; type: string; denomination: string | null; place: string | null; province: string | null;
  website: string | null; enrichment_status: string; enriched_at: string | null; general_email: string | null;
  contact_id: string | null; contact_name: string | null; contact_role: string | null; contact_email: string | null;
  contact_status: string | null; contact_source: string | null; contact_seen: string | null; contact_kind: string | null;
  role_label: string | null;
};

/**
 * Per organisatie het eerste bruikbare contact volgens de voorkeursvolgorde,
 * met het algemene adres als laatste redmiddel.
 */
export function bestContactLateral(prefParam: string, includePersonal: boolean) {
  const personal = includePersonal ? "" : " and (c.email_kind is distinct from 'persoonlijk' or c.email is null)";
  return `left join lateral (
      select c.id, c.display_name, c.role, c.email, c.status, c.source_url, c.seen_at, c.email_kind, r.label as role_label
      from contacts c join roles r on r.key = c.role
      where c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.email is not null${personal}
        and c.role = any(${prefParam}::text[])
      order by array_position(${prefParam}::text[], c.role), c.confidence desc, c.seen_at desc nulls last
      limit 1) bc on true`;
}

export async function searchOrganizations(f: SearchFilter, page = 1, pageSize = 50, preference?: string[]) {
  const type = f.type || "kerk";
  const prefs = preference ?? DEFAULT_PREFERENCE[type] ?? DEFAULT_PREFERENCE.kerk;
  const { sql, params } = buildWhere(f, prefs);
  const prefParam = `$${params.length + 1}`;
  const offset = (page - 1) * pageSize;

  const rows = await query<ResultRow>(
    `select o.id, o.name, o.type, o.denomination, o.place, o.province, o.website, o.enrichment_status, o.enriched_at, o.general_email,
            bc.id as contact_id, bc.display_name as contact_name, bc.role as contact_role, bc.email as contact_email,
            bc.status as contact_status, bc.source_url as contact_source, bc.seen_at as contact_seen, bc.email_kind as contact_kind,
            bc.role_label
     from organizations o
     ${bestContactLateral(prefParam, false)}
     where ${sql}
     order by o.place nulls last, o.name
     limit ${pageSize} offset ${offset}`,
    [...params, prefs],
  );

  const counts = await one<{ total: string; with_email: string; with_role: string }>(
    `select count(*) as total,
            count(*) filter (where bc.email is not null or o.general_email is not null) as with_email,
            count(*) filter (where bc.email is not null and bc.role <> 'algemeen') as with_role
     from organizations o
     ${bestContactLateral(prefParam, false)}
     where ${sql}`,
    [...params, prefs],
  );

  return {
    rows,
    total: Number(counts?.total ?? 0),
    withEmail: Number(counts?.with_email ?? 0),
    withRole: Number(counts?.with_role ?? 0),
    page,
    pageSize,
  };
}

export async function facetCounts(f: SearchFilter) {
  const base: SearchFilter = { ...f, denominations: [], provinces: [] };
  const { sql, params } = buildWhere(base);
  const denominations = await query<{ denomination: string; n: string }>(
    `select o.denomination, count(*) as n from organizations o where ${sql} and o.denomination is not null group by 1 order by 2 desc`,
    params,
  );
  const { sql: sql2, params: params2 } = buildWhere({ ...f, provinces: [] });
  const provinces = await query<{ province: string; n: string }>(
    `select o.province, count(*) as n from organizations o where ${sql2} and o.province is not null group by 1 order by 1`,
    params2,
  );
  return {
    denominations: denominations.map((d) => ({ key: d.denomination, n: Number(d.n) })),
    provinces: provinces.map((p) => ({ key: p.province, n: Number(p.n) })),
  };
}
