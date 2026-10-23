import { describe, expect, it } from "vitest";
import { safeApplyLink } from "./attributes";
import { parseOfferText } from "./import";
import { jobQuery, parseJobFilters } from "./params";
import { checkOffer } from "./rules";

describe("règles de publication", () => {
  it("bloque les critères discriminatoires", () => {
    const rules = (text: string) => checkOffer(text).map((hit) => hit.rule);
    expect(rules("Recherchons comptable, âge maximum 35 ans.")).toContain("Limite d’âge");
    expect(rules("Hôtesse : femmes uniquement")).toContain("Sexe imposé");
    expect(rules("Candidat célibataire de préférence")).toContain("Situation familiale");
    expect(rules("Physique agréable exigé")).toContain("Apparence physique");
  });

  it("bloque les signes d'arnaque", () => {
    expect(checkOffer("Frais de dossier : 10 000 FCFA à verser").map((hit) => hit.rule)).toContain("Paiement demandé au candidat");
    expect(checkOffer("Envoyez 5 000 F par Orange Money pour réserver le poste").map((hit) => hit.rule)).toContain("Transfert d’argent");
    expect(checkOffer("Gagnez 50 000 F par jour sans effort").map((hit) => hit.rule)).toContain("Gains irréalistes");
  });

  it("laisse passer une offre ordinaire", () => {
    expect(checkOffer("Comptable confirmé, 3 ans d’expérience, CDI, poste à San Pedro. Envoyez CV et lettre.")).toEqual([]);
  });
});

describe("texte d'offre collé", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  it("reconnaît titre, contrat, date limite, e-mail et lien", () => {
    const draft = parseOfferText(
      "Assistant logistique portuaire\nCDD de 6 mois.\nCandidatures avant le 15 novembre 2026 à rh@exemple.ci ou https://exemple.ci/postuler.",
      now,
    );
    expect(draft).toMatchObject({ titre: "Assistant logistique portuaire", contrat: "cdd", date_limite: "2026-11-15", email: "rh@exemple.ci", lien: "https://exemple.ci/postuler" });
    expect(draft.found).toHaveLength(5);
  });
  it("date numérique, et rien d'inventé quand l'information manque", () => {
    expect(parseOfferText("Stage comptable\nDate limite : 30/11/2026", now).date_limite).toBe("2026-11-30");
    expect(parseOfferText("Poste\nDate limite : 31/02/2026", now).date_limite).toBeNull();
    expect(parseOfferText("Annonce sans détails", now)).toMatchObject({ contrat: null, date_limite: null, email: null, lien: null });
  });
});

describe("lien de candidature", () => {
  it("https seulement, sans identifiants", () => {
    expect(safeApplyLink("https://www.exemple.ci/postuler")).toEqual({ href: "https://www.exemple.ci/postuler", host: "exemple.ci" });
    for (const value of ["http://exemple.ci", "javascript:alert(1)", "https://user:pass@exemple.ci", "pas un lien"]) expect(safeApplyLink(value)).toBeNull();
  });
});

describe("filtres de l'espace emploi", () => {
  it("forme canonique et valeurs inconnues ignorées", () => {
    const filters = parseJobFilters({ type: "stages", contrat: "cdi", domaine: "informatique", depuis: "7", teletravail: "lune" });
    expect(jobQuery(filters)).toBe("type=stages&contrat=cdi&domaine=informatique&depuis=7");
  });
});
