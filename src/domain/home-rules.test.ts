import { describe, expect, it } from "vitest";
import { eventBadge, eventMoment } from "./event-timing";
import { rankPlaces } from "./recommendation";

// Mercredi 21 octobre 2026, 10:00 à Abidjan (UTC+0).
const now = new Date("2026-10-21T10:00:00Z");
const at = (iso: string) => new Date(iso);

describe("moment d'un événement", () => {
  it("distingue aujourd'hui, demain, ce week-end, cette semaine et plus tard", () => {
    expect(eventMoment(at("2026-10-21T19:00:00Z"), null, now)).toBe("today");
    expect(eventMoment(at("2026-10-22T19:00:00Z"), null, now)).toBe("tomorrow");
    expect(eventMoment(at("2026-10-24T19:00:00Z"), null, now)).toBe("weekend");
    expect(eventMoment(at("2026-10-25T09:00:00Z"), null, now)).toBe("weekend");
    expect(eventMoment(at("2026-10-27T19:00:00Z"), null, now)).toBe("week");
    expect(eventMoment(at("2026-11-15T19:00:00Z"), null, now)).toBe("later");
  });

  it("reconnaît un événement en cours et un événement terminé", () => {
    expect(eventMoment(at("2026-10-21T08:00:00Z"), at("2026-10-21T12:00:00Z"), now)).toBe("ongoing");
    expect(eventMoment(at("2026-10-20T19:00:00Z"), at("2026-10-20T22:00:00Z"), now)).toBe("past");
    // Sans heure de fin : en cours jusqu'à la fin de sa journée, terminé le lendemain.
    expect(eventMoment(at("2026-10-21T08:00:00Z"), null, now)).toBe("ongoing");
    expect(eventMoment(at("2026-10-20T20:00:00Z"), null, now)).toBe("past");
  });

  it("ne présente jamais un événement annulé ou passé comme à venir", () => {
    expect(eventBadge(at("2026-10-24T19:00:00Z"), null, "cancelled", now)).toEqual({ label: "Annulé", tone: "danger" });
    expect(eventBadge(at("2026-10-01T19:00:00Z"), null, "scheduled", now).label).toBe("Terminé");
    expect(eventBadge(at("2026-10-24T19:00:00Z"), null, "postponed", now)).toEqual({ label: "Reporté · Ce week-end", tone: "warning" });
  });
});

describe("classement des lieux", () => {
  it("place d'abord les vérifications à jour, puis les mises à jour récentes", () => {
    const places = [
      { id: "exemple", verificationStatus: "placeholder" as const, verifiedAt: null, updatedAt: "2026-10-20T00:00:00Z" },
      { id: "a-verifier", verificationStatus: "pending_validation" as const, verifiedAt: null, updatedAt: "2026-10-19T00:00:00Z" },
      { id: "verifie-ancien", verificationStatus: "verified" as const, verifiedAt: "2024-01-01T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" },
      { id: "verifie", verificationStatus: "verified" as const, verifiedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
    ];
    // Une vérification expirée redevient « à vérifier » : elle passe après les vérifications à jour.
    expect(rankPlaces(places, now).map((place) => place.id)).toEqual(["verifie", "verifie-ancien", "a-verifier", "exemple"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const places = [{ verificationStatus: "placeholder" as const, verifiedAt: null, updatedAt: "2026-10-20T00:00:00Z" }];
    expect(rankPlaces(places, now)).not.toBe(places);
  });
});
