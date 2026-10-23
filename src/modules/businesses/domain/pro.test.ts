import { describe, expect, it } from "vitest";
import { completeness, formatDayHours, linksSchema, pageSchema, parseDayHours, parseWeekHours, proBadges, splitList } from "./pro";

const full = {
  description: "Plomberie générale, recherche de fuites, installation sanitaire et dépannage rapide dans tout San Pedro.",
  category: { name: "Plomberie" },
  services: ["Dépannage"],
  service_area: "San Pedro et environs",
  phone: "+225 07 00 00 00 00",
  whatsapp: null,
  email: null,
  website: null,
  opening_hours: { lun: [["08:00", "17:00"]] },
  photoCount: 1,
};

describe("badges et complétude", () => {
  it("un profil complet n'est pas pour autant vérifié", () => {
    expect(completeness(full).complete).toBe(true);
    expect(proBadges({ verified: false, verificationPending: false, complete: true, sponsored: false })).toEqual(["complete"]);
  });

  it("liste ce qui manque", () => {
    const result = completeness({ ...full, photoCount: 0, opening_hours: null, services: [] });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(["Au moins une prestation", "Des horaires", "Au moins une photo"]);
  });

  it("« vérifié » remplace « en cours de validation », le sponsoring reste distinct", () => {
    expect(proBadges({ verified: true, verificationPending: true, complete: false, sponsored: true })).toEqual(["verified", "sponsored"]);
    expect(proBadges({ verified: false, verificationPending: true, complete: false, sponsored: false })).toEqual(["pending"]);
  });
});

describe("saisie des horaires", () => {
  it("comprend les formats usuels", () => {
    expect(parseDayHours("8h-12h, 14:00 - 18:30")).toEqual({ ok: true, slots: [["08:00", "12:00"], ["14:00", "18:30"]] });
    expect(parseDayHours("Fermé")).toEqual({ ok: true, slots: [] });
    expect(parseDayHours("")).toEqual({ ok: true, slots: undefined });
  });

  it("refuse un horaire impossible et le dit", () => {
    const result = parseDayHours("18:00-08:00");
    expect(result.ok).toBe(false);
    expect(parseWeekHours({ lun: "n'importe quoi" }).ok).toBe(false);
  });

  it("se relit à l'identique", () => {
    expect(formatDayHours([["08:00", "12:00"]])).toBe("08:00-12:00");
    expect(formatDayHours([])).toBe("fermé");
    expect(parseWeekHours({ lun: "08:00-12:00", dim: "fermé" })).toEqual({ ok: true, hours: { lun: [["08:00", "12:00"]], dim: [] } });
  });
});

describe("formulaire", () => {
  it("n'accepte que des liens https", () => {
    expect(linksSchema.safeParse([{ label: "Facebook", url: "http://exemple.ci" }]).success).toBe(false);
    expect(linksSchema.safeParse([{ label: "Facebook", url: "https://user:pass@exemple.ci" }]).success).toBe(false);
    expect(linksSchema.safeParse([{ label: "Facebook", url: "https://facebook.com/exemple" }]).success).toBe(true);
  });

  it("nettoie les champs facultatifs et les listes", () => {
    const parsed = pageSchema.parse({
      name: "  Zqp Plomberie ",
      categoryId: "00000000-0000-4000-8000-000000000001",
      neighborhoodId: null,
      description: "",
      services: splitList("Dépannage\nDépannage, Installation", 30, 80),
      serviceArea: "",
      availabilityNote: undefined,
      acceptsQuotes: true,
      phone: "",
      whatsapp: "",
      email: "",
      website: "",
      links: [],
      faq: [],
    });
    expect(parsed.name).toBe("Zqp Plomberie");
    expect(parsed.description).toBeNull();
    expect(parsed.services).toEqual(["Dépannage", "Installation"]);
    expect(parsed.phone).toBeNull();
  });
});
