"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type AuthResult } from "@/features/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(login, null);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mailadres</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && !state.ok ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Bezig met inloggen" : "Log in"}
      </Button>
    </form>
  );
}
