# Organisatiezoeker

Interne tool van Jona zinvolle technologie om organisaties (kerken, goede doelen) te
zoeken, te verrijken met openbaar gepubliceerde contactgegevens en te exporteren
naar CSV of Excel. Eén gebruiker, 2FA verplicht, draait als Dokploy-compose op
zoeker.jonacommunicatie.cloud.

Bronnen van waarheid, in deze volgorde:

1. Het plan: https://claude.ai/artifact/6p2Z8DD4nU5EYZthp11uUU
2. De schetsen: https://claude.ai/artifact/VPsWsFJeSVdihBz1hT2Gew
3. Het Jona design system (tokens in `src/app/globals.css`, primitives in
   `src/components/ui/`, overgenomen uit rhadders/actualisatietool).

## Next.js

Dit is Next.js 16: lees `node_modules/next/dist/docs/` voordat je iets schrijft.
`proxy.ts` is de middleware, `params`/`searchParams`/`cookies()` zijn async,
`LayoutProps<"/">` en `PageProps<"/pad">` komen uit `next typegen`.

## Architectuur

- Alle data via `src/lib/db.ts` (pg, rol postgres). Geen PostgREST in de app.
- Auth via `src/lib/supabase/server.ts` (alleen inloggen en MFA). De browser
  praat nooit met Supabase: alles loopt via server actions.
- `requireUser()` in elke pagina en actie; `proxy.ts` is de eerste grens.
- De worker draait in-process (`src/instrumentation.ts`) en verwerkt `jobs`.
- Migraties in `migrations/*.sql`, idempotent, uitgevoerd bij containerstart.
- Bestanden (exports, gecachte pagina's) staan in Postgres, niet in Storage.

## Code

- Gebruikersteksten Nederlands in de "je"-vorm, zinskapitalen, knoppen
  werkwoord-eerst. Identifiers Engels, enumwaarden Nederlands waar de UI ze toont.
- Geen harde merkkleuren in componenten: tokens uit `globals.css`. Teal is het
  enige accent, hooguit één accentknop per scherm. Geen unicode als icoon.
- Het logo komt uit `public/brand/` en wordt nooit nagetekend.
- Cijfers altijd als geheel getal met percentage erachter waar het een deel is.
- Elke formulier krijgt `noValidate`.
- Geen persoonsgegevens in logs: id's mogen, namen en e-mailadressen niet.

## Voor elke push

```bash
npm run lint && npm run typecheck && npm run build
```
