"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { query } from "@/lib/db";
import { createUserClient } from "@/lib/supabase/server";

export type AuthResult = { ok: true } | { ok: false; error: string };

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/zoeken";
  return next;
}

export async function login(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Vul een e-mailadres en wachtwoord in." };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    await query("insert into audit_log (actor, action, details) values ($1, 'login_mislukt', $2)", [
      parsed.data.email,
      JSON.stringify({ reason: error.code ?? error.message }),
    ]);
    return { ok: false, error: "E-mailadres of wachtwoord klopt niet." };
  }

  await query("insert into audit_log (actor, action) values ($1, 'login')", [parsed.data.email]);

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel === "aal1") redirect("/mfa");
  if (assurance?.nextLevel === "aal1") redirect("/mfa/instellen");
  redirect(safeNext(parsed.data.next));
}

export async function logout() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut({ scope: "global" });
  if (user?.email) {
    await query("insert into audit_log (actor, action) values ($1, 'logout')", [user.email]);
  }
  redirect("/login");
}

/** Start de inschrijving van een authenticator-app: levert QR-code en geheim. */
export async function startEnrollment(): Promise<
  { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string }
> {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  // Oude, niet-afgemaakte inschrijvingen opruimen.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Organisatiezoeker ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { ok: false, error: "Inschrijven lukt niet. Probeer het opnieuw." };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

const codeSchema = z.object({
  factorId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/),
});

/** Bevestigt de inschrijving met de eerste code; daarna is de sessie aal2. */
export async function confirmEnrollment(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = codeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Vul de code van zes cijfers in." };

  const supabase = await createUserClient();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factorId,
  });
  if (cErr || !challenge) return { ok: false, error: "Controle starten lukt niet." };
  const { error } = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (error) return { ok: false, error: "De code klopt niet. Kijk of de tijd op je telefoon goed staat." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await query("insert into audit_log (actor, action) values ($1, 'mfa_ingesteld')", [user?.email ?? null]);
  redirect("/zoeken");
}

const verifySchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

/** Tweede stap bij het inloggen. */
export async function verifyMfa(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = verifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Vul de code van zes cijfers in." };

  const supabase = await createUserClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/mfa/instellen");

  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (cErr || !challenge) return { ok: false, error: "Controle starten lukt niet." };
  const { error } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code: parsed.data.code,
  });
  if (error) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await query("insert into audit_log (actor, action) values ($1, 'mfa_mislukt')", [user?.email ?? null]);
    return { ok: false, error: "De code klopt niet." };
  }
  redirect("/zoeken");
}

const passwordSchema = z
  .object({
    current: z.string().min(1),
    password: z.string().min(12, "Minimaal 12 tekens"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "De wachtwoorden zijn niet gelijk", path: ["confirm"] });

export async function changePassword(_prev: AuthResult | null, formData: FormData): Promise<AuthResult> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Controleer de invoer." };

  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Niet ingelogd." };

  const { error: checkErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current,
  });
  if (checkErr) return { ok: false, error: "Het huidige wachtwoord klopt niet." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Wachtwoord wijzigen lukt niet." };
  await query("insert into audit_log (actor, action) values ($1, 'wachtwoord_gewijzigd')", [user.email]);
  return { ok: true };
}
