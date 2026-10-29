import "server-only";
import { redirect } from "next/navigation";

import { createUserClient } from "@/lib/supabase/server";

export type Assurance = {
  currentLevel: string | null;
  nextLevel: string | null;
};

export function needsMfaVerification(a: Assurance | null | undefined) {
  return a?.currentLevel === "aal1" && a.nextLevel === "aal2";
}

export function needsMfaEnrollment(a: Assurance | null | undefined) {
  return a?.currentLevel === "aal1" && a.nextLevel === "aal1";
}

/**
 * Eist een ingelogde gebruiker met een aal2-sessie. Elke pagina en actie in de
 * app roept dit aan; proxy.ts is de eerste grens, dit de tweede.
 */
export async function requireUser() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (needsMfaVerification(assurance)) redirect("/mfa");
  if (needsMfaEnrollment(assurance)) redirect("/mfa/instellen");

  return { user, supabase };
}
