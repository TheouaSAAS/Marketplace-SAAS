import { describe, expect, it } from "vitest";
import { LISTING_STATE_ORDER, listingActions, mutedCategories, SENSITIVE_ACTIONS, withSiteChannels } from "./dashboard";

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
    expect(mutedCategories(null)).toEqual([]);
    expect(mutedCategories({ avis: { site: false }, rappel: { site: true }, inconnu: { site: false } })).toEqual(["avis"]);
    expect(mutedCategories("n'importe quoi")).toEqual([]);
  });

  it("enregistre les cases cochées sans perdre les autres canaux", () => {
    const saved = withSiteChannels({ avis: { email: true } }, ["candidature"]);
    expect(saved.avis).toEqual({ email: true, site: false });
    expect(saved.candidature).toEqual({ site: true });
    expect(mutedCategories(saved)).toEqual(["avis", "equipe", "evenement", "rappel"]);
  });
});
