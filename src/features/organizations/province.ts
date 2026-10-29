/*
 * Provincie uit een Nederlandse postcode (eerste twee cijfers). Een benadering
 * langs de gangbare reeksen; goed genoeg als filter, niet als adresbron.
 */
const RANGES: [number, number, string][] = [
  [10, 19, "Noord-Holland"],
  [20, 29, "Zuid-Holland"],
  [30, 34, "Utrecht"],
  [35, 35, "Utrecht"],
  [36, 36, "Flevoland"],
  [37, 39, "Utrecht"],
  [40, 42, "Gelderland"],
  [43, 46, "Zeeland"],
  [47, 51, "Noord-Brabant"],
  [52, 56, "Noord-Brabant"],
  [57, 60, "Noord-Brabant"],
  [61, 65, "Limburg"],
  [66, 69, "Gelderland"],
  [70, 73, "Gelderland"],
  [74, 76, "Overijssel"],
  [77, 77, "Overijssel"],
  [78, 79, "Drenthe"],
  [80, 83, "Overijssel"],
  [82, 83, "Flevoland"],
  [84, 85, "Friesland"],
  [86, 86, "Friesland"],
  [87, 89, "Friesland"],
  [90, 91, "Friesland"],
  [92, 93, "Drenthe"],
  [94, 94, "Drenthe"],
  [95, 99, "Groningen"],
];

// Uitzonderingen op de tweecijferreeksen (grofweg).
const OVERRIDES: Record<string, string> = {
  "13": "Noord-Holland",
  "80": "Overijssel",
  "81": "Overijssel",
  "82": "Flevoland",
  "83": "Flevoland",
  "84": "Friesland",
  "85": "Friesland",
  "86": "Friesland",
  "90": "Friesland",
  "91": "Friesland",
  "92": "Drenthe",
  "93": "Drenthe",
  "94": "Drenthe",
  "41": "Gelderland",
  "42": "Zuid-Holland",
  "39": "Utrecht",
  "37": "Gelderland",
  "67": "Gelderland",
};

export function provinceFromPostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.match(/\b(\d{4})\s?[A-Z]{2}\b/i);
  if (!m) return null;
  const two = m[1].slice(0, 2);
  if (OVERRIDES[two]) return OVERRIDES[two];
  const n = Number(two);
  for (const [lo, hi, prov] of RANGES) if (n >= lo && n <= hi) return prov;
  return null;
}

export const PROVINCES = [
  "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
  "Noord-Brabant", "Noord-Holland", "Overijssel", "Utrecht", "Zeeland", "Zuid-Holland",
];
