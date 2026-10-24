import { describe, expect, it } from "vitest";
import { estimateCostUsd, sanitizeAiSuggestions } from "./ai-output";
import { extractFromText, suggestCategories } from "./assistant";
import { cleanAttributes, draftSchema, EMPTY_DRAFT, missingInformation, submissionProblems } from "./fields";
import { assessPhoto } from "./photos";
import { checkListing } from "./rules";

const NOW = new Date("2026-10-23T10:00:00Z");
const pick = (suggestions: ReturnType<typeof extractFromText>, field: string) => suggestions.find((item) => item.field === field)?.value;

describe("assistant de saisie (règles)", () => {
  it("repère prix, unité, téléphone et caractéristiques d'un logement", () => {
    const text = "Appartement 3 pièces à louer\n2 chambres, 85 m², meublé, à Bardot.\nLoyer : 150 000 FCFA par mois, à débattre. Tél 07 08 09 10 11";
    const found = extractFromText(text, "immobilier", NOW);
    expect(pick(found, "title")).toBe("Appartement 3 pièces à louer");
    expect(pick(found, "price")).toBe(150000);
    expect(pick(found, "priceUnit")).toBe("par_mois");
    expect(pick(found, "negotiable")).toBe(true);
    expect(pick(found, "contactPhone")).toBe("+225 07 08 09 10 11");
    expect(pick(found, "attributes.chambres")).toBe(2);
    expect(pick(found, "attributes.pieces")).toBe(3);
    expect(pick(found, "attributes.surface_m2")).toBe(85);
    expect(pick(found, "attributes.type_bien")).toBe("appartement");
    expect(pick(found, "attributes.meuble")).toBe(true);
    for (const suggestion of found) {
      expect(suggestion.origin).toBe("regles");
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("repère les informations d'un véhicule et les millions", () => {
    const found = extractFromText("Toyota Corolla 2015, 120 000 km, essence, boîte automatique. Prix 4,5 millions F", "vehicule", NOW);
    expect(pick(found, "attributes.marque")).toBe("Toyota");
    expect(pick(found, "attributes.annee")).toBe(2015);
    expect(pick(found, "attributes.kilometrage")).toBe(120000);
    expect(pick(found, "attributes.carburant")).toBe("essence");
    expect(pick(found, "attributes.boite")).toBe("automatique");
    expect(pick(found, "price")).toBe(4500000);
  });

  it("n'invente rien quand le texte ne dit rien", () => {
    const found = extractFromText("Bonjour, je vends quelque chose de bien", "vehicule", NOW);
    expect(found.map((item) => item.field)).toEqual(["title", "description"]);
  });

  it("propose une catégorie d'après les mots-clés", () => {
    const categories = [
      { id: "1", name: "Plomberie", keywords: ["fuite", "robinet", "tuyau"], parentName: "Artisans" },
      { id: "2", name: "Voitures", keywords: ["voiture", "berline"], parentName: "Véhicules" },
    ];
    const [best] = suggestCategories("Je répare les fuites et les robinets", categories);
    expect(best?.id).toBe("1");
    expect(best?.matched).toEqual(expect.arrayContaining(["fuite", "robinet"]));
    expect(suggestCategories("", categories)).toEqual([]);
  });
});

describe("champs et validation", () => {
  it("un brouillon vide est valide, la soumission exige l'essentiel", () => {
    expect(draftSchema.parse({})).toEqual(EMPTY_DRAFT);
    const problems = submissionProblems(EMPTY_DRAFT, "bien").map((problem) => problem.field);
    expect(problems).toEqual(["title", "description", "location"]);
    expect(submissionProblems(EMPTY_DRAFT, "formation").map((problem) => problem.field)).not.toContain("location");
  });

  it("refuse un téléphone ou un e-mail invalide", () => {
    expect(draftSchema.safeParse({ contactPhone: "abc" }).success).toBe(false);
    expect(draftSchema.safeParse({ contactEmail: "pas-un-email" }).success).toBe(false);
    expect(draftSchema.parse({ contactPhone: "+225 07 08 09 10 11" }).contactPhone).toBe("+225 07 08 09 10 11");
  });

  it("ne garde que les attributs connus et bien typés", () => {
    expect(cleanAttributes("immobilier", { chambres: "3", meuble: true, type_bien: "chateau", inconnu: 1 })).toEqual({ chambres: 3, meuble: true });
    expect(cleanAttributes(null, { chambres: 3 })).toEqual({});
  });

  it("signale les informations manquantes sans les inventer", () => {
    const missing = missingInformation({ ...EMPTY_DRAFT, description: "Court" }, "bien", 0);
    expect(missing.join(" ")).toMatch(/Aucune photo/);
    expect(missing.join(" ")).toMatch(/Pas de prix/);
    expect(missing.join(" ")).toMatch(/Description courte/);
  });
});

describe("contenus interdits et photos", () => {
  it("bloque les objets interdits et les arnaques classiques", () => {
    expect(checkListing("Vends pistolet en bon état").map((hit) => hit.rule)).toContain("Armes et munitions");
    expect(checkListing("Frais de visite à payer par Orange Money avant").map((hit) => hit.rule)).toEqual(
      expect.arrayContaining(["Paiement avant visite", "Transfert d’argent préalable"]),
    );
    expect(checkListing("Belle table en bois massif, très bon état")).toEqual([]);
  });

  it("bloque l'acompte exigé à distance ou avant la visite, pas l'acompte à la signature", () => {
    expect(checkListing("Envoyez un acompte par Western Union pour réserver").map((hit) => hit.rule)).toContain("Paiement avant visite");
    expect(checkListing("Acompte avant la visite obligatoire").map((hit) => hit.rule)).toContain("Paiement avant visite");
    expect(checkListing("Versez l’acompte et je vous envoie les clés").map((hit) => hit.rule)).toContain("Paiement avant visite");
    expect(checkListing("Un mois d’acompte demandé à la signature du bail, après visite")).toEqual([]);
  });

  it("refuse les mauvais formats et signale les photos faibles", () => {
    expect(assessPhoto({ type: "image/gif", bytes: 1000, width: 1000, height: 1000 }).errors).toHaveLength(1);
    expect(assessPhoto({ type: "image/jpeg", bytes: 6 * 1024 * 1024, width: 1000, height: 1000 }).errors).toHaveLength(1);
    const weak = assessPhoto({ type: "image/jpeg", bytes: 100_000, width: 640, height: 480 });
    expect(weak.errors).toEqual([]);
    expect(weak.warnings[0]).toMatch(/faible résolution/);
  });
});

describe("contrôle des suggestions de l'IA", () => {
  const source = "Studio meublé à louer, 75 000 F par mois. Appeler le 07 08 09 10 11.";

  it("écarte un champ inconnu, une valeur hors liste et une valeur sans extrait dans le texte", () => {
    const kept = sanitizeAiSuggestions(
      [
        { field: "price", value: 75000, confidence: 0.9, excerpt: "75 000 F" },
        { field: "attributes.type_bien", value: "chateau", confidence: 0.9, excerpt: "Studio" },
        { field: "attributes.chambres", value: 2, confidence: 0.9, excerpt: "2 chambres" },
        { field: "owner_id", value: "x", confidence: 1, excerpt: "Studio" },
        { field: "attributes.meuble", value: true, confidence: 1.4, excerpt: "meublé" },
      ],
      { schema: "immobilier", input: "texte", source },
    );
    expect(kept.map((item) => item.field)).toEqual(["price", "attributes.meuble"]);
    expect(kept.every((item) => item.origin === "ia")).toBe(true);
    expect(kept.find((item) => item.field === "attributes.meuble")?.confidence).toBe(0.9);
  });

  it("plafonne la confiance d'une photo ou d'un PDF", () => {
    const [photo] = sanitizeAiSuggestions([{ field: "attributes.etat", value: "bon", confidence: 0.95, excerpt: "table sans rayure visible" }], { schema: "bien", input: "photo", source: null });
    expect(photo?.confidence).toBe(0.5);
    const [pdf] = sanitizeAiSuggestions([{ field: "title", value: "Table en bois", confidence: 0.95, excerpt: "Table en bois" }], { schema: "bien", input: "pdf", source: null });
    expect(pdf?.confidence).toBe(0.6);
  });

  it("estime le coût prudemment pour un modèle inconnu", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(estimateCostUsd("modele-inconnu", 1_000_000, 0)).toBe(10);
  });
});
