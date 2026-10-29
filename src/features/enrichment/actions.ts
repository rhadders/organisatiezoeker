"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DENOMINATIONS } from "@/features/import/denominations";
import { parseFilter } from "@/features/organizations/search-shared";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

import { createImportRun, createRun, pauseRun, resumeRun } from "./runs";

export type SimpleResult = { ok: true } | { ok: false; error: string };

export async function startRun(_prev: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const { user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || `Verrijking ${new Date().toLocaleDateString("nl-NL")}`;
  const sp: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && k.startsWith("f_")) sp[k.slice(2)] = v;
  const filter = parseFilter(sp);
  if (!filter.type) filter.type = "kerk";
  const onlyNew = formData.get("onlyNew") === "on";
  const { runId, total } = await createRun(name, filter, { onlyNew });
  if (!total) {
    await query("delete from enrichment_runs where id = $1", [runId]);
    return { ok: false, error: "Geen organisaties in deze selectie om te verrijken." };
  }
  await query("insert into audit_log (actor, action, subject, details) values ($1,'run_gestart',$2,$3)", [user.email ?? "", runId, JSON.stringify({ total, filter })]);
  redirect(`/verrijking/${runId}`);
}

export async function startImport(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const codes = formData.getAll("denomination").map(String).filter((c) => c in DENOMINATIONS);
  if (!codes.length) return;
  const runId = await createImportRun(codes);
  await query("insert into audit_log (actor, action, subject, details) values ($1,'import_gestart',$2,$3)", [user.email ?? "", runId, JSON.stringify(codes)]);
  revalidatePath("/bronnen");
}

export async function togglePause(runId: string, pause: boolean): Promise<SimpleResult> {
  await requireUser();
  if (pause) await pauseRun(runId);
  else await resumeRun(runId);
  revalidatePath(`/verrijking/${runId}`);
  revalidatePath("/verrijking");
  return { ok: true };
}

export async function confirmAllAbove(threshold: number): Promise<SimpleResult> {
  const { user } = await requireUser();
  const rows = await query<{ organization_id: string }>(
    `update contacts set status = 'zeker' where is_current and status = 'te_controleren' and confidence >= $1 returning organization_id`,
    [Math.max(50, Math.min(100, Math.round(threshold)))],
  );
  const orgIds = [...new Set(rows.map((r) => r.organization_id))];
  for (const id of orgIds) {
    await query(
      `update organizations set enrichment_status = case
         when exists (select 1 from contacts where organization_id = $1 and is_current and status = 'te_controleren') then 'controleren'
         when exists (select 1 from contacts where organization_id = $1 and is_current and status = 'zeker' and email is not null) then 'compleet'
         else enrichment_status end where id = $1`,
      [id],
    );
  }
  await query("insert into audit_log (actor, action, details) values ($1,'bulk_bevestigd',$2)", [user.email ?? "", JSON.stringify({ threshold, contacts: rows.length })]);
  revalidatePath("/verrijking");
  return { ok: true };
}
