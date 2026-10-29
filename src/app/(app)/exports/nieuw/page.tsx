import type { Metadata } from "next";

import { COLUMNS, collectRows } from "@/features/export/build";
import { DEFAULT_PREFERENCE, parseFilter } from "@/features/organizations/search";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

import { ExportWizard } from "./export-wizard";

export const metadata: Metadata = { title: "Nieuwe export" };

export default async function NewExportPage(props: PageProps<"/exports/nieuw">) {
  const { user } = await requireUser();
  const sp = await props.searchParams;
  const filter = parseFilter(sp);
  if (!filter.type) filter.type = "kerk";
  const type = filter.type;
  const preference = DEFAULT_PREFERENCE[type];
  const roles = await query<{ key: string; label: string }>("select key, label from roles where applies_to = 'beide' or applies_to = $1 order by sort_order", [type]);

  // Voorbeeld en tellingen met de standaardinstellingen; de wizard herberekent bij wijzigingen via de server action.
  const preview = await collectRows({
    name: "", filter, columns: COLUMNS.map((c) => c.key), preference, allContacts: false, includePersonal: false, skipRecentDays: 0, format: "xlsx", createdBy: user.email ?? "",
  });
  const recent = await collectRows({
    name: "", filter, columns: COLUMNS.map((c) => c.key), preference, allContacts: false, includePersonal: false, skipRecentDays: 90, format: "xlsx", createdBy: user.email ?? "",
  });
  const perRole = new Map<string, number>();
  for (const r of preview) perRole.set(r.rol ?? "—", (perRole.get(r.rol ?? "—") ?? 0) + 1);

  return (
    <ExportWizard
      filter={filter}
      roles={roles}
      preference={preference}
      columns={COLUMNS}
      previewRows={preview.slice(0, 6).map((r) => ({ organisatie: r.organisatie, plaats: r.plaats, type: r.type, contactpersoon: r.contactpersoon, rol: r.rol, email: r.email, bron: r.bron, gezien: r.gezien }))}
      total={preview.length}
      skippedRecent={preview.length - recent.length}
      perRole={[...perRole.entries()].map(([rol, n]) => ({ rol, n }))}
    />
  );
}
