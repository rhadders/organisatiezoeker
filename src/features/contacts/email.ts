/*
 * Pure helpers rond e-mailadressen: normaliseren en functioneel/persoonlijk
 * onderscheiden. Geen afleiding uit naampatronen: wat niet gepubliceerd is,
 * bestaat voor de tool niet.
 */
const FUNCTIONAL_LOCAL = [
  "info", "scriba", "scribaat", "kerkelijkbureau", "kerkelijk.bureau", "bureau", "secretariaat",
  "secretaris", "secretary", "diaconie", "diakonie", "kerkrentmeesters", "cvk", "college",
  "predikant", "dominee", "pastoor", "pastorie", "pastoraat", "jeugd", "jeugdwerk", "kerkblad",
  "redactie", "communicatie", "pers", "marketing", "fondsenwerving", "fondsen", "donateurs",
  "giften", "penningmeester", "voorzitter", "koster", "beheer", "contact", "algemeen", "office",
  "administratie", "admin", "receptie", "mail", "post", "welkom", "kerk", "gemeente", "pr",
  "nieuwsbrief", "vrijwilligers", "hr", "directie", "bestuur", "kantoor", "kerkenraad",
];

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase().replace(/^mailto:/, "").split("?")[0];
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return null;
  return e;
}

export function emailKind(email: string): "functioneel" | "persoonlijk" {
  const local = email.split("@")[0].replace(/[^a-z.]/g, "");
  if (FUNCTIONAL_LOCAL.some((f) => local === f || local.startsWith(f + ".") || local.startsWith(f))) {
    return "functioneel";
  }
  // Voorletters met punten (j.de.vries) of voornaam.achternaam wijzen op een persoon.
  return "persoonlijk";
}

/** Rol afleiden uit het local-part, voor bronlijsten en voor een snelle eerste indeling. */
export function roleFromEmail(email: string): string | null {
  const local = email.split("@")[0].toLowerCase();
  if (/scriba/.test(local)) return "scriba";
  if (/kerkelijk.?bureau|^bureau|secretariaat|secretaris/.test(local)) return "kerkelijk_bureau";
  if (/predikant|dominee|pastoor|pastorie/.test(local)) return "predikant";
  if (/diacon/.test(local)) return "diaconie";
  if (/kerkrentmeester|cvk|beheer/.test(local)) return "kerkrentmeesters";
  if (/jeugd/.test(local)) return "jeugdwerk";
  if (/kerkblad|redactie|communicatie|pers$|nieuwsbrief/.test(local)) return "communicatie";
  if (/marketing/.test(local)) return "marketing";
  if (/fondsen|donateur|giften|relatiebeheer/.test(local)) return "fondsenwerving";
  if (/directie|directeur|bestuur/.test(local)) return "directie";
  if (/^info|^contact|^algemeen|^office|^mail|^post|^welkom|^kerk$|^gemeente$/.test(local)) return "algemeen";
  return null;
}
