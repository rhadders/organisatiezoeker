import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/exports/[id]/download">) {
  const { user } = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Niet gevonden", { status: 404 });
  const row = await one<{ file_name: string; file_bytes: Buffer; format: string }>("select file_name, file_bytes, format from exports where id = $1", [id]);
  if (!row?.file_bytes) return new NextResponse("Niet gevonden", { status: 404 });
  await query("insert into audit_log (actor, action, subject) values ($1,'export_download',$2)", [user.email ?? "", id]);
  const type = row.format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return new NextResponse(new Uint8Array(row.file_bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${row.file_name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
