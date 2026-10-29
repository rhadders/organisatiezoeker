"use server";

import { redirect } from "next/navigation";

import { parseFilter } from "@/features/organizations/search-shared";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

import { buildExport, COLUMNS } from "./build";

export type SimpleResult = { ok: true } | { ok: false; error: string };

export async function createExport(_prev: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const { user } = await requireUser();
  const sp: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k.startsWith("f_")) sp[k.slice(2)] = v;
  const filter = parseFilter(sp);
  if (!filter.type) filter.type = "kerk";

  const name = String(formData.get("name") ?? "").trim() || `Export ${new Date().toLocaleDateString("nl-NL")}`;
  const columns = formData.getAll("column").map(String).filter((c) => COLUMNS.some((x) => x.key === c));
  if (!columns.length) return { ok: false, error: "Kies minstens één kolom." };
  const preference = String(formData.get("preference") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!preference.length) return { ok: false, error: "Kies minstens één rol in de voorkeursvolgorde." };
  const format = formData.get("format") === "csv" ? "csv" : "xlsx";
  const allContacts = formData.get("allContacts") === "on";
  const includePersonal = formData.get("includePersonal") === "on";
  const skipRecentDays = formData.get("skipRecent") === "on" ? 90 : 0;

  const result = await buildExport({ name, filter, columns, preference, allContacts, includePersonal, skipRecentDays, format, createdBy: user.email ?? "" });
  await query("insert into audit_log (actor, action, subject, details) values ($1,'export',$2,$3)", [
    user.email ?? "",
    result.id,
    JSON.stringify({ rows: result.rowCount, format, filter, preference, allContacts, includePersonal }),
  ]);
  redirect(`/exports?nieuw=${result.id}`);
}
