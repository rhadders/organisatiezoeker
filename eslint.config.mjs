import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * De service-role-client slaat RLS over. Hij hoort alleen thuis waar geen
 * ingelogde gebruiker is: de ontvangerflow, de jobrunner, webhooks en scripts.
 * Overal anders is de user-client verplicht, zodat RLS de grens blijft.
 */
const serviceClientAllowlist = [
  "src/features/recipient/**",
  "src/features/jobs/**",
  // De outbox-transport schrijft naar mail_outbox, een tabel zonder policies.
  "src/features/email/transport.ts",
  "src/features/email/resend.ts",
  "src/features/email/webhook.ts",
  // Statusmeldingen van de drukpartner voor brieven per post; alleen met
  // geldige handtekening.
  "src/features/post/webhook.ts",
  "src/features/sms/webhook.ts",
  // Websitechat (plan 58): bezoekers hebben geen sessie en de beantwoorder komt
  // via de webhook van Meta (alleen met geldige handtekening). Alleen de
  // opslag zelf; de rest van src/features/chat gaat via dit bestand.
  "src/features/chat/store.ts",
  // Mails aan gebruikers (plan 61): sjablonen lezen, het logboek schrijven en
  // afmelden via de link in een mail. Ook zonder sessie (registratie, jobs).
  "src/features/email/service/store.ts",
  "src/app/api/webhooks/**",
  "src/lib/supabase/admin.ts",
  // Auth-beheer-API en storage van de beheeromgeving; alleen na
  // requirePlatformAdmin() (appbeheerder én AAL2).
  "src/features/platform/auth-admin.ts",
  // Fouten van het platform vastleggen (plan 9); alleen via de RPC
  // report_platform_error, en de adressen van appbeheerders voor de mail.
  "src/features/platform/error-report.ts",
  // De foutenroutine en de webhook van GitHub (plan 25); alleen achter een
  // eigen geheim of een geldige handtekening, en alleen via de automation_-RPC's.
  "src/features/platform/error-automation.ts",
  // De limietteller hoort bij de ontvangerflow en heeft geen sessie.
  "src/lib/rate-limit.ts",
  "scripts/**",
  "tests/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "createServiceClient slaat RLS over. Gebruik createUserClient, of voeg het bestand toe aan de allowlist in eslint.config.mjs als het echt een ontvanger-, job-, webhook- of scriptpad is.",
            },
          ],
        },
      ],
    },
  },
  {
    files: serviceClientAllowlist,
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/supabase/types.gen.ts",
    "playwright-report/**",
    "test-results/**",
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
