import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Exports" };

export default async function ExportsPage(props: PageProps<"/exports">) {
  await requireUser();
  const { nieuw } = await props.searchParams;
  const exports = await query<{ id: string; name: string; format: string; row_count: number; created_at: string; file_name: string | null; email_preference: string[]; all_contacts: boolean }>(
    "select id, name, format, row_count, created_at, file_name, email_preference, all_contacts from exports order by created_at desc limit 50",
  );
  const fresh = typeof nieuw === "string" ? exports.find((e) => e.id === nieuw) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight">Exports</h1>
          <p className="text-muted-foreground">Elke export wordt bewaard, zodat je later alleen nieuwe organisaties krijgt en altijd opnieuw kunt downloaden.</p>
        </div>
        <Button asChild className="ml-auto">
          <Link href="/exports/nieuw">
            <Plus /> Nieuwe export
          </Link>
        </Button>
      </div>

      {fresh ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              &ldquo;{fresh.name}&rdquo; is klaar: {formatNumber(fresh.row_count)} rijen.
            </span>
            <Button asChild size="sm" variant="accent">
              <a href={`/api/exports/${fresh.id}/download`}>
                <Download /> Download {fresh.format === "csv" ? "CSV" : "Excel"}
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Eerdere exports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-mist-50 text-2xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium">Naam</th>
                <th className="px-3 py-2.5 text-left font-medium">Datum</th>
                <th className="px-3 py-2.5 text-left font-medium">Rijen</th>
                <th className="px-3 py-2.5 text-left font-medium">Voorkeur</th>
                <th className="px-3 py-2.5 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {exports.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDateTime(e.created_at)}</td>
                  <td className="px-3 py-3">{formatNumber(e.row_count)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{e.all_contacts ? "alle contacten" : e.email_preference.join(" → ")}</td>
                  <td className="px-3 py-3 text-right">
                    <Button asChild variant="link" size="sm">
                      <a href={`/api/exports/${e.id}/download`}>Download opnieuw ({e.format})</a>
                    </Button>
                  </td>
                </tr>
              ))}
              {!exports.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Nog geen exports.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
