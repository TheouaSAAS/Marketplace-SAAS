import { describe, expect, it } from "vitest";
import { canConfirm, channelPreferences, LISTING_STATE_ORDER, listingActions, SENSITIVE_ACTIONS, withChannels } from "./dashboard";

describe("états d'annonce", () => {
  it("chaque état a des actions cohérentes avec les règles de la base", () => {
    expect(listingActions("draft")).toEqual(["continuer", "supprimer"]);
    expect(listingActions("published")).toContain("archiver");
    expect(listingActions("expired")).toContain("renouveler");
    expect(listingActions("archived")).toEqual([]);
    expect(LISTING_STATE_ORDER).toHaveLength(6);
  });

  it("archiver et supprimer demandent une confirmation", () => {
    expect(SENSITIVE_ACTIONS).toEqual(["archiver", "supprimer"]);
  });
});

describe("préférences de notification", () => {
  it("lit prudemment les préférences enregistrées", () => {
    const empty = channelPreferences(null);
    expect(Object.values(empty.site).every(Boolean)).toBe(true);
    expect(Object.values(empty.email).every(Boolean)).toBe(true);
    expect(empty.emailOff).toBe(false);
    const read = channelPreferences({ avis: { site: false, email: false }, decisions: { site: false }, _email: { off: true }, inconnu: 1 });
    expect(read.site.avis).toBe(false);
    expect(read.email.avis).toBe(false);
    expect(read.site.decisions).toBe(true);
    expect(read.emailOff).toBe(true);
    expect(channelPreferences("n'importe quoi").site.rappel).toBe(true);
  });

  it("enregistre chaque canal sans perdre les clés inconnues ; les décisions restent sur le site", () => {
    const saved = withChannels({ futur: { push: true } }, { site: ["candidature"], email: ["message"], emailOff: false });
    expect(saved.futur).toEqual({ push: true });
    expect(saved.avis).toEqual({ site: false, email: false });
    expect(saved.message).toEqual({ site: false, email: true });
    expect(saved.decisions).toEqual({ site: true, email: false });
    expect(saved._email).toEqual({ off: false });
    expect(channelPreferences(saved).site.candidature).toBe(true);
  });
});

describe("confirmation d'une annonce", () => {
  it("n'est proposée que dans les 7 jours avant la fin de diffusion", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(canConfirm("2026-10-26T12:00:00Z", now)).toBe(true);
    expect(canConfirm("2026-11-15T12:00:00Z", now)).toBe(false);
    expect(canConfirm("2026-10-22T12:00:00Z", now)).toBe(false);
    expect(canConfirm(null, now)).toBe(false);
  });
});
