import "server-only";
import Anthropic from "@anthropic-ai/sdk";

import { query } from "@/lib/db";
import { env } from "@/lib/env";

export type PageText = { url: string; title: string | null; text: string };

export type ExtractedContact = {
  naam: string | null;
  rol: string;
  email: string | null;
  telefoon: string | null;
  citaat: string;
  zekerheid: number;
  toelichting: string;
};

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
// Richtprijzen in dollarcent per miljoen tokens; alleen voor de kostenindicatie.
const INPUT_CENTS_PER_M = Number(process.env.ANTHROPIC_INPUT_CENTS_PER_M ?? 100);
const OUTPUT_CENTS_PER_M = Number(process.env.ANTHROPIC_OUTPUT_CENTS_PER_M ?? 500);

const MAX_PAGE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 48_000;

/**
 * Laat een taalmodel contactpersonen uit de platte tekst halen. Alleen wat
 * letterlijk op de pagina staat; geen afgeleide e-mailadressen.
 */
export async function extractContacts(
  org: { id: string; name: string; type: "kerk" | "goed_doel"; place: string | null },
  roles: { key: string; label: string }[],
  pages: PageText[],
): Promise<ExtractedContact[]> {
  if (!env.ANTHROPIC_API_KEY || !pages.length) return [];

  let budget = MAX_TOTAL_CHARS;
  const parts: string[] = [];
  for (const p of pages) {
    if (budget <= 0) break;
    const slice = p.text.slice(0, Math.min(MAX_PAGE_CHARS, budget));
    budget -= slice.length;
    parts.push(`### Pagina: ${p.url}${p.title ? ` (${p.title})` : ""}\n${slice}`);
  }

  const roleList = roles.map((r) => `- ${r.key}: ${r.label}`).join("\n");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const system = `Je haalt contactpersonen uit openbaar gepubliceerde webpagina's van een ${org.type === "kerk" ? "kerkelijke gemeente" : "goededoelenorganisatie"} in Nederland.
Regels:
- Neem alleen over wat letterlijk op de pagina staat. Leid nooit een e-mailadres af uit een naam of patroon.
- Een functioneel adres zonder naam (scriba@..., info@...) is een geldig contact; laat de naam dan leeg.
- Kies de rol uit de lijst. Past geen rol, gebruik 'algemeen' alleen voor een algemeen adres van de organisatie zelf; anders laat het contact weg.
- Zekerheid 90-100 als rol, naam/adres en organisatie ondubbelzinnig bij elkaar horen; 50-79 bij twijfel (wisseling aangekondigd, rol afgeleid uit een paginatitel, meerdere kandidaten); onder 50 als het waarschijnlijk niet klopt.
- Adressen van koepels, leveranciers of andere organisaties horen er niet bij.
- Citaat: letterlijk fragment van maximaal 200 tekens waaruit het blijkt.
Rollen:
${roleList}`;

  const user = `Organisatie: ${org.name}${org.place ? ` (${org.place})` : ""}\n\n${parts.join("\n\n")}`;

  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: user }],
    tools: [
      {
        name: "registreer_contacten",
        description: "Registreer de gevonden contactpersonen en functionele adressen.",
        input_schema: {
          type: "object",
          properties: {
            contacten: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  naam: { type: ["string", "null"], description: "Naam van de persoon, of null bij een functioneel adres" },
                  rol: { type: "string", enum: roles.map((r) => r.key) },
                  email: { type: ["string", "null"] },
                  telefoon: { type: ["string", "null"] },
                  citaat: { type: "string" },
                  zekerheid: { type: "integer", minimum: 0, maximum: 100 },
                  toelichting: { type: "string", description: "Eén zin: waarom deze score" },
                },
                required: ["naam", "rol", "email", "telefoon", "citaat", "zekerheid", "toelichting"],
              },
            },
          },
          required: ["contacten"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "registreer_contacten" },
  });

  const usage = response.usage;
  const cost = (usage.input_tokens * INPUT_CENTS_PER_M + usage.output_tokens * OUTPUT_CENTS_PER_M) / 1_000_000;
  await query(
    "insert into ai_calls (organization_id, model, input_tokens, output_tokens, cost_cents) values ($1,$2,$3,$4,$5)",
    [org.id, DEFAULT_MODEL, usage.input_tokens, usage.output_tokens, cost.toFixed(4)],
  );

  const tool = response.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") return [];
  const input = tool.input as { contacten?: ExtractedContact[] };
  return (input.contacten ?? []).filter((c) => c && typeof c.rol === "string");
}
