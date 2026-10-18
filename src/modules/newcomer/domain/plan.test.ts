// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasPage } from "@/config/routes";
import { answersFromSearchParams, answersSchema, answersToSearchParams, type NewcomerAnswers } from "./answers";
import { BLOCKS, buildPlan, MAX_BLOCKS } from "./plan";

const answers = (overrides: Partial<NewcomerAnswers> = {}): NewcomerAnswers =>
  answersSchema.parse({ purpose: "s_installer", duration: "longue_duree", housing: "location", ...overrides });

const keys = (input: NewcomerAnswers) => buildPlan(input).blocks.map((block) => block.key);

describe("plan selon le motif", () => {
  it("installation durable : logement, quartiers, courses, santé, services essentiels", () => {
    expect(keys(answers())).toEqual(["logement", "quartiers", "courses", "sante", "demarches", "transport", "sorties"]);
  });

  it("visite courte : hébergement court, tourisme, restaurants, événements", () => {
    const plan = keys(answers({ purpose: "visiter", duration: "quelques_jours", housing: "non_precise" }));
    expect(plan.slice(0, 4)).toEqual(["hebergement", "tourisme", "restaurants", "evenements"]);
    expect(plan).not.toContain("logement");
  });

  it("entreprendre : contacts, opportunités, locaux", () => {
    expect(keys(answers({ purpose: "entreprendre" })).slice(0, 3)).toEqual(["reseau_pro", "opportunites", "locaux_pro"]);
  });

  it("une personne déjà logée ne reçoit aucun bloc logement", () => {
    const plan = keys(answers({ housing: "aucun" }));
    for (const lodging of ["logement", "hebergement", "achat"] as const) expect(plan).not.toContain(lodging);
  });

  it("un projet d'achat propose les ventes, pas les locations", () => {
    const plan = keys(answers({ housing: "achat" }));
    expect(plan).toContain("achat");
    expect(plan).not.toContain("logement");
  });

  it("un séjour de quelques jours n'inclut ni quartiers ni démarches", () => {
    const plan = keys(answers({ purpose: "s_installer", duration: "quelques_jours", housing: "non_precise" }));
    expect(plan).not.toContain("quartiers");
    expect(plan).not.toContain("demarches");
    expect(plan[0]).toBe("hebergement");
  });
});

describe("priorités et centres d'intérêt", () => {
  it("place les priorités en tête, dans l'ordre choisi", () => {
    const plan = keys(answers({ priorities: ["sante", "emploi"] }));
    expect(plan.slice(0, 2)).toEqual(["sante", "emploi"]);
  });

  it("explique pourquoi chaque bloc est proposé", () => {
    const plan = buildPlan(answers({ priorities: ["transport"], mobility: "taxi" }));
    const transport = plan.blocks.find((block) => block.key === "transport")!;
    expect(transport.reasons).toContain("Vous avez choisi « Me déplacer » parmi vos priorités.");
    expect(transport.reasons).toContain("Vous prévoyez de vous déplacer : taxi et transports.");
    for (const block of plan.blocks) expect(block.reasons.length).toBeGreaterThan(0);
  });

  it("ajoute les blocs liés aux centres d'intérêt", () => {
    expect(keys(answers({ purpose: "travailler", interests: ["gastronomie", "plage"] }))).toEqual(
      expect.arrayContaining(["restaurants", "tourisme"]),
    );
  });

  it("ne dépasse jamais le nombre maximal de blocs", () => {
    const plan = buildPlan(
      answers({ priorities: ["emploi", "ecoles", "tourisme", "reseau_pro"], interests: ["plage", "gastronomie", "culture", "sport", "famille"] }),
    );
    expect(plan.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
  });

  it("n'estime jamais de prix : le budget n'apparaît que comme rappel", () => {
    const plan = buildPlan(answers({ budget: "serre" }));
    const lodging = plan.blocks.find((block) => block.key === "logement")!;
    expect(lodging.note).toMatch(/Nous n’estimons aucun prix/);
    expect(JSON.stringify(plan)).not.toMatch(/FCFA|\d{4,}/);
  });

  it("reprend la précision libre du motif « autre »", () => {
    const plan = buildPlan(answers({ purpose: "autre", purposeOther: "Mission humanitaire" }));
    expect(plan.summary[0]).toBe("Mission humanitaire");
    expect(plan.blocks.some((block) => block.reasons.includes("Vous avez indiqué : « Mission humanitaire »."))).toBe(true);
  });
});

describe("cohérence avec le référentiel et les routes", () => {
  const seed = readFileSync(new URL("../../../../supabase/seed.sql", import.meta.url), "utf8");

  it("chaque catégorie utilisée existe dans les données de référence", () => {
    for (const [key, block] of Object.entries(BLOCKS)) {
      const categories = "categories" in block.content ? block.content.categories : [];
      for (const slug of categories) expect(seed, `${key} → ${slug}`).toContain(`'${slug}'`);
      for (const action of block.actions) if (action.category) expect(seed, action.category).toContain(`'${action.category}'`);
    }
  });

  it("chaque action mène à une page existante", () => {
    for (const block of Object.values(BLOCKS)) for (const action of block.actions) expect(hasPage(action.route), action.label).toBe(true);
  });
});

describe("réponses dans l'adresse", () => {
  it("font l'aller-retour sans perte", () => {
    const original = answers({ budget: "moyen", mobility: "deux_roues", priorities: ["logement", "sante"], interests: ["plage"] });
    const params = Object.fromEntries(answersToSearchParams(original));
    expect(answersFromSearchParams(params)).toEqual(original);
  });

  it("rejettent des réponses incomplètes ou inventées", () => {
    expect(answersFromSearchParams({ motif: "visiter" })).toBeNull();
    expect(answersFromSearchParams({ motif: "pirater", duree: "quelques_jours", logement: "aucun" })).toBeNull();
  });

  it("ignorent les doublons et limitent les priorités", () => {
    const parsed = answersFromSearchParams({ motif: "visiter", duree: "quelques_jours", logement: "aucun", priorites: "sante,sante,transport" });
    expect(parsed?.priorities).toEqual(["sante", "transport"]);
    expect(answersFromSearchParams({ motif: "visiter", duree: "quelques_jours", logement: "aucun", priorites: "sante,transport,emploi,courses,ecoles" })).toBeNull();
  });

  it("ne transportent aucune donnée personnelle", () => {
    const params = answersToSearchParams(answers({ purpose: "autre", purposeOther: "Mutation" }));
    expect([...params.keys()].sort()).toEqual(["budget", "duree", "logement", "mobilite", "motif", "precision"]);
  });
});
