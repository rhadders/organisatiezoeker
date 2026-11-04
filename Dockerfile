# Organisatiezoeker — Next.js standalone build
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# De npm-cache blijft tussen builds bewaard (BuildKit cache-mount), zodat een
# gewijzigd lockfile niet alles opnieuw hoeft te downloaden.
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# De bouwcache van Next (.next/cache) blijft tussen builds bewaard, zodat na een
# kleine wijziging alleen het gewijzigde deel opnieuw gecompileerd wordt. De
# cache zit niet in het image; het runner-stadium kopieert alleen standalone en static.
RUN --mount=type=cache,id=organisatiezoeker-next-cache,target=/app/.next/cache npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# De commit waaruit het image komt; /api/health meldt hem, zodat de workflow
# na het uitrollen kan zien dat de nieuwe versie draait.
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=$SOURCE_COMMIT
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/scripts ./scripts
USER nextjs
EXPOSE 3000
# Eerst migraties en de eerste gebruiker, dan de server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node scripts/bootstrap-user.mjs && node server.js"]
