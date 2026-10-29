import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const { user, supabase } = await requireUser();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.filter((f) => f.status === "verified") ?? [];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight">Instellingen</h1>
        <p className="text-muted-foreground">Ingelogd als {user.email}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Wachtwoord</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Authenticator</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {totp.length ? (
            <ul className="flex flex-col gap-1">
              {totp.map((f) => (
                <li key={f.id}>
                  {f.friendly_name ?? "Authenticator"} · gekoppeld op{" "}
                  {new Date(f.created_at).toLocaleDateString("nl-NL")}
                </li>
              ))}
            </ul>
          ) : (
            <p>Geen authenticator gekoppeld.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
