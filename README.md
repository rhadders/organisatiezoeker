# Organisatiezoeker

Zoek, selecteer, verrijk en exporteer organisaties met contactpersonen. Versie 1
richt zich op kerken (PKN, CGK, NGK, HHK) met scriba en kerkelijk bureau; versie 2
op goede doelen met communicatie, marketing en fondsenwerving.

- Plan: https://claude.ai/artifact/6p2Z8DD4nU5EYZthp11uUU
- Schetsen: https://claude.ai/artifact/VPsWsFJeSVdihBz1hT2Gew
- Productie: https://zoeker.jonacommunicatie.cloud (Dokploy-project Organisatiezoeker)

## Stack

Next.js 16, een afgeslankte self-hosted Supabase (Postgres 17, Auth met TOTP,
PostgREST, Envoy, Studio) in één Docker Compose, Anthropic API voor extractie.

## Lokaal

```bash
cp .env.example .env.local   # vul de waarden in
npm install
npm run migrate              # tegen DATABASE_URL
npm run dev
```

## Uitrol

Dokploy bouwt bij elke push op `main`. De compose (`docker-compose.yml`) bevat de
hele stack; geheimen staan in de Dokploy-omgeving. Bij de start draait de app
`scripts/migrate.mjs` en `scripts/bootstrap-user.mjs`.

## Eerste keer inloggen

De eerste gebruiker is `BOOTSTRAP_ADMIN_EMAIL` met als wachtwoord
`DASHBOARD_PASSWORD` uit de Dokploy-omgeving. Wijzig dat wachtwoord direct onder
Instellingen; de authenticator-app wordt bij de eerste login afgedwongen.
