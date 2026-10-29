"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type AuthResult } from "@/features/auth/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(changePassword, null);

  return (
    <form action={action} noValidate className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">Huidig wachtwoord</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Nieuw wachtwoord (minimaal 12 tekens)</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Nog een keer</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
      </div>
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert>
          <AlertDescription>Wachtwoord gewijzigd.</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          Wijzig wachtwoord
        </Button>
      </div>
    </form>
  );
}
