"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmEnrollment, logout, type AuthResult } from "@/features/auth/actions";

export function EnrollForm({ factorId, qr, secret }: { factorId: string; qr: string; secret: string }) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(confirmEnrollment, null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6">
        {/* Supabase levert de QR als data-URI (svg). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR-code voor je authenticator-app" width={192} height={192} />
        <p className="text-center text-xs text-muted-foreground">
          Lukt scannen niet? Voer dit geheim handmatig in:
          <br />
          <code className="font-mono text-foreground">{secret}</code>
        </p>
      </div>
      <form action={action} noValidate className="flex flex-col gap-5">
        <input type="hidden" name="factorId" value={factorId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Eerste code uit de app</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="text-center text-lg tracking-[0.4em]"
          />
        </div>
        {state && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Controleren" : "Koppel authenticator"}
        </Button>
      </form>
      <form action={logout}>
        <Button type="submit" variant="link" size="sm" className="px-0">
          Uitloggen
        </Button>
      </form>
    </div>
  );
}
