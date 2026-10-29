import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";
import { startEnrollment } from "@/features/auth/actions";

import { EnrollForm } from "./enroll-form";

export const metadata: Metadata = { title: "Authenticator instellen" };

export default async function EnrollPage() {
  const enrollment = await startEnrollment();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Logo className="mb-10 h-12" />
        <h1 className="mb-1 font-serif text-xl font-medium tracking-tight">
          Authenticator-app instellen
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Tweestapsverificatie is verplicht. Scan de code met bijvoorbeeld 1Password,
          Google Authenticator of Microsoft Authenticator en vul daarna de eerste code in.
        </p>
        {enrollment.ok ? (
          <EnrollForm factorId={enrollment.factorId} qr={enrollment.qr} secret={enrollment.secret} />
        ) : (
          <p className="text-sm text-destructive">{enrollment.error}</p>
        )}
      </div>
    </main>
  );
}
