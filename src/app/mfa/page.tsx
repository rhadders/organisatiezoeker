import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";

import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Tweestapsverificatie" };

export default function MfaPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 h-12" />
        <h1 className="mb-1 font-serif text-xl font-medium tracking-tight">Tweede stap</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Vul de code uit je authenticator-app in.
        </p>
        <VerifyForm />
      </div>
    </main>
  );
}
