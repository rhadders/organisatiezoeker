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

Het image wordt niet op de VPS gebouwd. Na elke merge naar `main` bouwt de
workflow `.github/workflows/deploy-image.yml` het op de MacBook (runner met het
label `macbook`, zoals bij tirgumai), zet het in de eigen registry als
`registry.jonacommunicatie.cloud/organisatiezoeker-app:<UTC-tijd>-<korte commit>`
en `latest`, en roept de deploy-webhook van de compose in Dokploy aan. Dokploy
haalt dan de stack opnieuw op (`docker-compose.yml`, service `app` met
`pull_policy: always`) en wacht de workflow tot `/api/health` de nieuwe commit
meldt. Geheimen staan in de Dokploy-omgeving. Bij de start draait de app
`scripts/migrate.mjs` en `scripts/bootstrap-user.mjs`.

Wat de workflow nodig heeft, onder Settings → Secrets and variables → Actions:

| Naam | Soort | Waarde |
|---|---|---|
| `IMAGE_REGISTRY` | variabele | `registry.jonacommunicatie.cloud` |
| `REGISTRY_USERNAME`, `REGISTRY_PASSWORD` | secrets | de gebruiker van de registry (Dokploy → project Registry → registry → Environment) |
| `DOKPLOY_DEPLOY_WEBHOOK` | secret | de deploy-webhook van de compose (Dokploy → compose → Deployments → Webhook URL) |
| `DEPLOY_ON_PUSH` | variabele, optioneel | `false`: na een merge alleen bouwen en pushen, niet uitrollen |
| `IMAGE_RUNNER` | variabele, optioneel | een ander label dan `macbook` |
| `APP_HEALTH_URL` | variabele, optioneel | standaard `https://zoeker.jonacommunicatie.cloud/api/health` |

Deze repository is openbaar en de runner staat op de MacBook: laat workflows
op `pull_request` achterwege, of laat ze op de runners van GitHub draaien,
zodat code uit een fork nooit op de MacBook draait.

Staat de MacBook uit, dan wacht de job in de rij (tot 24 uur). Terug naar een
eerdere versie: zet in `docker-compose.yml` (of tijdelijk in Dokploy) het image
op een van de tien bewaarde tags en deploy.

## Eerste keer inloggen

De eerste gebruiker is `BOOTSTRAP_ADMIN_EMAIL` met als wachtwoord
`DASHBOARD_PASSWORD` uit de Dokploy-omgeving. Wijzig dat wachtwoord direct onder
Instellingen; de authenticator-app wordt bij de eerste login afgedwongen.
