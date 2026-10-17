import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatPrice } from "./format";

/** Intl utilise des espaces insécables : on les normalise pour comparer. */
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("formatPrice", () => {
  it("formate en FCFA avec séparateur de milliers", () => {
    expect(plain(formatPrice(150000))).toBe("150 000 FCFA");
    expect(plain(formatPrice(150000, "par_mois"))).toBe("150 000 FCFA / mois");
    expect(plain(formatPrice(5000, "a_partir_de"))).toBe("À partir de 5 000 FCFA");
  });

  it("n'invente jamais un prix absent", () => {
    expect(formatPrice(null)).toBe("Prix non communiqué");
    expect(formatPrice(undefined)).toBe("Prix non communiqué");
    expect(formatPrice(-1)).toBe("Prix non communiqué");
  });

  it("affiche Gratuit pour un montant nul", () => {
    expect(formatPrice(0)).toBe("Gratuit");
  });
});

describe("dates", () => {
  it("formate en français, fuseau d'Abidjan", () => {
    expect(formatDate("2026-10-17T23:30:00Z")).toBe("17 octobre 2026");
    expect(plain(formatDateTime("2026-10-17T20:00:00Z"))).toBe("samedi 17 octobre à 20:00");
  });

  it("signale une date invalide", () => {
    expect(formatDate("n'importe quoi")).toBe("Date inconnue");
  });
});
