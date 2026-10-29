import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseCgkList, parseHhkList, parseKoepelDetail } from "@/features/import/denominations";
import { emailKind, roleFromEmail } from "@/features/contacts/email";
import { provinceFromPostcode } from "@/features/organizations/province";
import { pickCandidates } from "@/features/enrichment/enrich";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("CGK-lijst", () => {
  const recs = parseCgkList(fx("cgk-lijst.html"));
  it("vindt alle gemeenten", () => {
    expect(recs.length).toBeGreaterThan(170);
  });
  it("leest Renswoude met scriba en website", () => {
    const r = recs.find((x) => x.place === "Renswoude")!;
    expect(r.website).toContain("cgkrenswoude");
    expect(r.classis).toBe("Utrecht");
    const scriba = r.contacts.find((c) => c.roleLabel.toLowerCase() === "scriba")!;
    expect(scriba.email).toBe("scriba@cgkrenswoude.nl");
    expect(scriba.name).toBe("J. Mulder");
    expect(r.diaconie_email).toBe("diaconie@cgkrenswoude.nl");
  });
  it("heeft bij ruim 90% een scriba met e-mail", () => {
    const withScriba = recs.filter((r) => r.contacts.some((c) => /scriba/i.test(c.roleLabel) && c.email)).length;
    expect(withScriba / recs.length).toBeGreaterThan(0.85);
  });
});

describe("HHK", () => {
  it("leest de lijst", () => {
    const recs = parseHhkList(fx("hhk-lijst.html"));
    expect(recs.length).toBeGreaterThan(100);
    const ede = recs.find((r) => /Ede - Bennekom/.test(r.name))!;
    expect(ede.address).toContain("6717 LP");
    expect(ede.href).toMatch(/^https:\/\/www\.hersteldhervormdekerk\.nl\/hhk\/gemeenten\//);
  });
  it("leest de detailpagina", () => {
    const d = parseKoepelDetail("https://www.hersteldhervormdekerk.nl/hhk/gemeenten/x", fx("hhk-detail.html"))!;
    expect(d.website).toBe("http://www.hhgede.nl");
    const scriba = d.contacts.find((c) => c.role === "scriba")!;
    expect(scriba.display_name).toBe("Bosch, G. van den");
    expect(scriba.phone).toBe("06-82940461");
  });
});

describe("NGK-detail", () => {
  it("leest website en e-mail scriba", () => {
    const d = parseKoepelDetail("https://ngk.nl/kerken/ngk-amersfoort-west/", fx("ngk-detail.html"))!;
    expect(d.website).toBe("www.westerkerk.org");
    expect(d.classis).toBe("Regio Amersfoort");
    expect(d.contacts.find((c) => c.role === "scriba")?.email).toBe("scriba@westerkerk.org");
    expect(d.contacts.find((c) => c.role === "diaconie")?.email).toBe("diaconie@westerkerk.org");
    expect(d.postal_address).toContain("Dollardstraat 58");
  });
});

describe("e-mailhelpers", () => {
  it("functioneel of persoonlijk", () => {
    expect(emailKind("scriba@kerk.nl")).toBe("functioneel");
    expect(emailKind("info@kerk.nl")).toBe("functioneel");
    expect(emailKind("j.de.vries@kerk.nl")).toBe("persoonlijk");
  });
  it("rol uit adres", () => {
    expect(roleFromEmail("scriba@kerk.nl")).toBe("scriba");
    expect(roleFromEmail("kerkelijkbureau@kerk.nl")).toBe("kerkelijk_bureau");
    expect(roleFromEmail("info@kerk.nl")).toBe("algemeen");
    expect(roleFromEmail("janine@kerk.nl")).toBeNull();
  });
  it("provincie uit postcode", () => {
    expect(provinceFromPostcode("3771 AB Barneveld")).toBe("Gelderland");
    expect(provinceFromPostcode("6717 LP EDE")).toBe("Gelderland");
    expect(provinceFromPostcode("3812 GB AMERSFOORT")).toBe("Utrecht");
    expect(provinceFromPostcode("9712 AB Groningen")).toBe("Groningen");
  });
});

describe("kandidaatpagina's", () => {
  it("kiest contact en anbi, laat externe links liggen", () => {
    const picks = pickCandidates("https://www.kerk.nl", [
      { href: "https://www.kerk.nl/contact/", text: "Contact" },
      { href: "https://www.kerk.nl/anbi", text: "ANBI" },
      { href: "https://www.kerk.nl/agenda", text: "Agenda" },
      { href: "https://facebook.com/kerk", text: "Contact" },
      { href: "https://www.kerk.nl/foto.jpg", text: "contact" },
    ]);
    expect(picks[0]).toBe("https://www.kerk.nl/contact");
    expect(picks).toContain("https://www.kerk.nl/anbi");
    expect(picks).not.toContain("https://www.kerk.nl/agenda");
    expect(picks.some((p) => p.includes("facebook"))).toBe(false);
  });
});
