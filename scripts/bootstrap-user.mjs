// Maakt de eerste gebruiker aan via de Auth-beheer-API als die nog niet bestaat.
// Zelfregistratie staat uit; dit is de enige weg naar een account.
const base = process.env.SUPABASE_INTERNAL_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!base || !key) {
  console.error("SUPABASE_INTERNAL_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  process.exit(1);
}
if (!email || !password) {
  console.log("Geen BOOTSTRAP_ADMIN_EMAIL/-PASSWORD: eerste gebruiker overgeslagen");
  process.exit(0);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function waitForAuth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/auth/v1/health`, { headers });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Auth niet bereikbaar na 2 minuten");
}

await waitForAuth();
const list = await fetch(`${base}/auth/v1/admin/users?page=1&per_page=50`, { headers });
if (!list.ok) {
  console.error("Gebruikers ophalen mislukt:", list.status, await list.text());
  process.exit(1);
}
const { users = [] } = await list.json();
if (users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
  console.log("Eerste gebruiker bestaat al");
  process.exit(0);
}
const res = await fetch(`${base}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, password, email_confirm: true }),
});
if (!res.ok) {
  console.error("Gebruiker aanmaken mislukt:", res.status, await res.text());
  process.exit(1);
}
console.log(`Eerste gebruiker aangemaakt: ${email}`);
