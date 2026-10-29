import "server-only";
import ExcelJS from "exceljs";

import { bestContactLateral, buildWhere } from "@/features/organizations/search";
import type { SearchFilter } from "@/features/organizations/search-shared";
import { one, query } from "@/lib/db";

export const COLUMNS: { key: string; label: string; default: boolean }[] = [
  { key: "organisatie", label: "Organisatie", default: true },
  { key: "plaats", label: "Plaats", default: true },
  { key: "provincie", label: "Provincie", default: false },
  { key: "type", label: "Kerkverband / type", default: true },
  { key: "classis", label: "Classis / regio", default: false },
  { key: "contactpersoon", label: "Contactpersoon", default: true },
  { key: "rol", label: "Rol", default: true },
  { key: "email", label: "E-mail", default: true },
  { key: "aanhef", label: "Aanhef (t.a.v.)", default: true },
  { key: "telefoon", label: "Telefoon", default: false },
  { key: "website", label: "Website", default: false },
  { key: "postadres", label: "Postadres", default: false },
  { key: "rsin", label: "RSIN / KVK", default: false },
  { key: "bron", label: "Bron-URL", default: true },
  { key: "gezien", label: "Gezien op", default: true },
  { key: "afmelden", label: "Afgemeld", default: true },
];

export type ExportOptions = {
  name: string;
  filter: SearchFilter;
  columns: string[];
  preference: string[];
  allContacts: boolean;
  includePersonal: boolean;
  skipRecentDays: number;
  format: "xlsx" | "csv";
  createdBy: string;
};

type Row = {
  organization_id: string; contact_id: string | null; organisatie: string; plaats: string | null; provincie: string | null; type: string | null; classis: string | null;
  contactpersoon: string | null; rol: string | null; email: string | null; telefoon: string | null; website: string | null; postadres: string | null;
  rsin: string | null; bron: string | null; gezien: string | null;
};

export async function collectRows(o: ExportOptions): Promise<Row[]> {
  const { sql, params } = buildWhere(o.filter, o.preference);
  const prefParam = `$${params.length + 1}`;
  const skip = o.skipRecentDays
    ? ` and not exists (select 1 from export_rows er join exports e on e.id = er.export_id where er.organization_id = o.id and e.created_at >= now() - ($${params.length + 2} || ' days')::interval)`
    : "";
  const all = [...params, o.preference, ...(o.skipRecentDays ? [o.skipRecentDays] : [])];

  if (o.allContacts) {
    const personal = o.includePersonal ? "" : " and (c.email_kind is distinct from 'persoonlijk')";
    return query<Row>(
      `select o.id as organization_id, c.id as contact_id, o.name as organisatie, o.place as plaats, o.province as provincie,
              coalesce(o.denomination, o.type) as type, o.classis, c.display_name as contactpersoon, r.label as rol, c.email, c.phone as telefoon,
              o.website, o.postal_address as postadres, coalesce(o.rsin, o.kvk_number) as rsin, c.source_url as bron, c.seen_at as gezien
       from organizations o
       join contacts c on c.organization_id = o.id and c.is_current and c.status = 'zeker' and c.email is not null${personal}
       join roles r on r.key = c.role
       where ${sql} and o.blocked_at is null${skip}
       order by o.place nulls last, o.name, r.sort_order`,
      all,
    );
  }

  return query<Row>(
    `select o.id as organization_id, bc.id as contact_id, o.name as organisatie, o.place as plaats, o.province as provincie,
            coalesce(o.denomination, o.type) as type, o.classis,
            bc.display_name as contactpersoon,
            case when bc.email is not null then bc.role_label when o.general_email is not null then 'Algemeen adres' end as rol,
            coalesce(bc.email, o.general_email) as email, null as telefoon,
            o.website, o.postal_address as postadres, coalesce(o.rsin, o.kvk_number) as rsin,
            coalesce(bc.source_url, o.source_url) as bron, coalesce(bc.seen_at, o.enriched_at) as gezien
     from organizations o
     ${bestContactLateral(prefParam, o.includePersonal)}
     where ${sql} and o.blocked_at is null and (bc.email is not null or o.general_email is not null)${skip}
     order by o.place nulls last, o.name`,
    all,
  );
}

function aanhef(row: Row) {
  if (row.contactpersoon) return `t.a.v. ${row.contactpersoon}${row.rol ? ` (${row.rol.toLowerCase()})` : ""}`;
  if (row.rol && row.rol !== "Algemeen adres") return `t.a.v. de ${row.rol.toLowerCase()}`;
  return "";
}

function cell(row: Row, key: string): string {
  switch (key) {
    case "aanhef":
      return aanhef(row);
    case "afmelden":
      return "";
    case "gezien":
      return row.gezien ? new Date(row.gezien).toLocaleDateString("nl-NL") : "";
    default:
      return String((row as Record<string, unknown>)[key] ?? "");
  }
}

export async function buildExport(o: ExportOptions): Promise<{ id: string; rowCount: number; fileName: string }> {
  const rows = await collectRows(o);
  const columns = COLUMNS.filter((c) => o.columns.includes(c.key));
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = o.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "export";
  const fileName = `${safeName}-${stamp}.${o.format}`;

  let bytes: Buffer;
  if (o.format === "csv") {
    const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [columns.map((c) => esc(c.label)).join(";"), ...rows.map((r) => columns.map((c) => esc(cell(r, c.key))).join(";"))];
    bytes = Buffer.from("﻿" + lines.join("\r\n"), "utf8");
  } else {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Organisatiezoeker";
    const ws = wb.addWorksheet("Organisaties", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.key === "email" || c.key === "bron" ? 36 : c.key === "organisatie" ? 40 : 18 }));
    ws.getRow(1).font = { bold: true };
    for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c.key, cell(r, c.key)])));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    bytes = Buffer.from(await wb.xlsx.writeBuffer());
  }

  const rec = await one<{ id: string }>(
    `insert into exports (name, filter_json, column_set, email_preference, all_contacts, include_personal, skip_recent_days, format, row_count, file_name, file_bytes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
    [o.name, JSON.stringify(o.filter), o.columns, o.preference, o.allContacts, o.includePersonal, o.skipRecentDays, o.format, rows.length, fileName, bytes, o.createdBy],
  );
  const id = rec!.id;
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.organization_id)) continue;
    seen.add(r.organization_id);
    await query("insert into export_rows (export_id, organization_id, contact_id) values ($1,$2,$3) on conflict do nothing", [id, r.organization_id, r.contact_id]);
  }
  return { id, rowCount: rows.length, fileName };
}
