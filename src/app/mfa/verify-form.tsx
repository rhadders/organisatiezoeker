"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logout, verifyMfa, type AuthResult } from "@/features/auth/actions";

export function VerifyForm() {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(verifyMfa, null);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
            className="text-center text-lg tracking-[0.4em]"
          />
        </div>
        {state && !state.ok ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Controleren" : "Bevestig"}
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
