import { describe, expect, it } from "vitest";
import { newPasswordSchema, passwordIssues, safeRedirectPath, signInSchema, signUpSchema } from "./schemas";

const valid = {
  displayName: "Awa Koné",
  email: "  Awa@Exemple.CI ",
  password: "motdepasse42",
  accountIntent: "particulier",
  acceptTerms: "on",
};

describe("politique de mot de passe", () => {
  it("exige 10 caractères, une lettre et un chiffre", () => {
    expect(passwordIssues("court1")).toContain("au moins 10 caractères");
    expect(passwordIssues("seulementdeslettres")).toContain("au moins un chiffre");
    expect(passwordIssues("1234567890")).toContain("au moins une lettre");
    expect(passwordIssues("motdepasse42")).toEqual([]);
  });
});

describe("inscription", () => {
  it("accepte un formulaire valide et normalise l'e-mail", () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("awa@exemple.ci");
    expect(result.data?.acceptTerms).toBe(true);
    expect(result.data?.marketingEmail).toBe(false);
  });

  it("refuse sans acceptation des conditions, avec un message clair", () => {
    const result = signUpSchema.safeParse({ ...valid, acceptTerms: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/accepter les conditions/);
  });

  it("refuse un mot de passe faible en expliquant pourquoi", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "abc" });
    expect(result.error?.issues[0]?.message).toMatch(/au moins 10 caractères, au moins un chiffre/);
  });

  it("refuse un type de compte inconnu", () => {
    expect(signUpSchema.safeParse({ ...valid, accountIntent: "admin" }).success).toBe(false);
  });
});

describe("connexion et mot de passe", () => {
  it("exige un e-mail valide et un mot de passe", () => {
    expect(signInSchema.safeParse({ email: "pas-un-email", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.ci", password: "" }).success).toBe(false);
  });

  it("vérifie la confirmation du nouveau mot de passe", () => {
    const result = newPasswordSchema.safeParse({ password: "nouveau12345", confirmation: "different123" });
    expect(result.error?.issues[0]?.path).toEqual(["confirmation"]);
  });
});

describe("redirection après connexion", () => {
  it("n'accepte que des chemins internes", () => {
    expect(safeRedirectPath("/profil")).toBe("/profil");
    expect(safeRedirectPath("/annonces?page=2")).toBe("/annonces?page=2");
    expect(safeRedirectPath("https://pirate.example")).toBe("/profil");
    expect(safeRedirectPath("//pirate.example")).toBe("/profil");
    expect(safeRedirectPath("/\\pirate.example")).toBe("/profil");
    expect(safeRedirectPath("/profil\r\nSet-Cookie: x")).toBe("/profil");
    expect(safeRedirectPath(undefined, "/")).toBe("/");
  });
});

describe("inscription : choix du profil", () => {
  const base = { displayName: "Awa", email: "awa@example.ci", password: "motdepasse1", acceptTerms: "on" };

  it("un profil utilisateur ne demande que les informations du compte", () => {
    const parsed = signUpSchema.safeParse({ ...base, accountIntent: "particulier", businessName: "", businessCategory: "" });
    expect(parsed.success).toBe(true);
  });

  it("un profil professionnel exige le nom et le secteur de l'activité", () => {
    const parsed = signUpSchema.safeParse({ ...base, accountIntent: "professionnel", businessName: "", businessCategory: "" });
    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["businessName", "businessCategory"]));
    expect(
      signUpSchema.safeParse({ ...base, accountIntent: "professionnel", businessName: "Salon Awa", businessCategory: "6f1c1c2e-8a1b-4c7d-9e2f-0a1b2c3d4e5f" }).success,
    ).toBe(true);
  });

  it("n'accepte aucun autre type de profil (jamais d'administration)", () => {
    for (const accountIntent of ["admin", "superadmin", "moderator", ""]) {
      expect(signUpSchema.safeParse({ ...base, accountIntent }).success, accountIntent).toBe(false);
    }
  });
});
