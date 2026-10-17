import { describe, expect, it } from "vitest";
import { displayedVerification, isReliable, VERIFICATION_META } from "./verification";

const now = new Date("2026-10-17T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

describe("fiabilité d'une donnée locale", () => {
  it("exige le statut vérifié ET une date de vérification", () => {
    expect(isReliable("verified", daysAgo(10), now)).toBe(true);
    expect(isReliable("verified", null, now)).toBe(false);
    expect(isReliable("pending_validation", daysAgo(1), now)).toBe(false);
    expect(isReliable("placeholder", daysAgo(1), now)).toBe(false);
  });

  it("expire selon le type d'information", () => {
    expect(isReliable("verified", daysAgo(100), now, "opening_hours")).toBe(true);
    expect(isReliable("verified", daysAgo(200), now, "opening_hours")).toBe(false);
    expect(isReliable("verified", daysAgo(100), now, "prices")).toBe(false);
  });

  it("refuse une date de vérification dans le futur ou invalide", () => {
    expect(isReliable("verified", daysAgo(-3), now)).toBe(false);
    expect(isReliable("verified", "pas-une-date", now)).toBe(false);
  });

  it("présente une vérification expirée comme « à vérifier »", () => {
    expect(displayedVerification("verified", daysAgo(400), now)).toBe("pending_validation");
    expect(displayedVerification("verified", daysAgo(5), now)).toBe("verified");
    expect(displayedVerification("placeholder", null, now)).toBe("placeholder");
  });

  it("ne montre jamais au public un exemple, un contenu archivé ou refusé", () => {
    expect(VERIFICATION_META.placeholder.showToPublic).toBe(false);
    expect(VERIFICATION_META.archived.showToPublic).toBe(false);
    expect(VERIFICATION_META.rejected.showToPublic).toBe(false);
  });
});
