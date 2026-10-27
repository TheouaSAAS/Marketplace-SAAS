import { describe, expect, it } from "vitest";
import { feeRateLabel, maskMeter, maskPhone, normalizeCiPhone, normalizeMeter, prefixNetwork, serviceFee, STATUS_META, totals } from "./cabin";

describe("frais de service de la cabine", () => {
  it("applique 0,5 % : 10 000 F CFA donnent 50 F de frais et 10 050 F à payer", () => {
    expect(totals(10_000, 50)).toEqual({ amount: 10_000, serviceFee: 50, providerFee: 0, total: 10_050 });
  });

  it("arrondit au franc entier le plus proche, demi-franc vers le haut (comme la base)", () => {
    expect([1, 99, 100, 150, 299, 300, 1_234].map((amount) => serviceFee(amount, 50))).toEqual([0, 0, 1, 1, 1, 2, 6]);
  });

  it("ajoute les frais du fournisseur séparément, dans le total", () => {
    expect(totals(5_000, 50, 100).total).toBe(5_125);
  });

  it("affiche le taux en clair", () => {
    expect(feeRateLabel(50)).toBe("0,5 %");
    expect(feeRateLabel(125)).toBe("1,25 %");
  });
});

describe("numéros et compteurs", () => {
  it("accepte les numéros ivoiriens à 10 chiffres, avec ou sans indicatif", () => {
    expect(normalizeCiPhone("+225 07 08 09 10 11")).toBe("0708091011");
    expect(normalizeCiPhone("00225 0501020304")).toBe("0501020304");
    expect(normalizeCiPhone("01.02.03.04.05")).toBe("0102030405");
    expect(normalizeCiPhone("08 01 02 03 04")).toBeNull();
    expect(normalizeCiPhone("0701020")).toBeNull();
  });

  it("indique le réseau d'origine du préfixe", () => {
    expect(prefixNetwork("0708091011")).toBe("orange");
    expect(prefixNetwork("0501020304")).toBe("mtn");
    expect(prefixNetwork("0102030405")).toBe("moov");
  });

  it("masque le numéro et le compteur", () => {
    expect(maskPhone("0708091011")).toBe("07 ** ** ** 11");
    expect(normalizeMeter("1234 5678 901")).toBe("12345678901");
    expect(maskMeter("12345678901")).toBe("*******8901");
    expect(normalizeMeter("12AB")).toBeNull();
  });

  it("ne déclare réussi qu'un état confirmé, et marque l'attente comme non finale", () => {
    expect(STATUS_META.succeeded.final).toBe(true);
    expect(STATUS_META.awaiting_confirmation.final).toBe(false);
    expect(STATUS_META.awaiting_confirmation.explanation).toContain("Ne relancez pas");
  });
});
