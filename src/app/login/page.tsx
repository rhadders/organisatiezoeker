import type { Metadata } from "next";

import { Logo } from "@/components/shared/logo";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Inloggen" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 h-12" />
        <h1 className="mb-1 font-serif text-xl font-medium tracking-tight text-foreground">
          Organisatiezoeker
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Intern. Log in met je e-mailadres, wachtwoord en authenticator-app.
        </p>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
