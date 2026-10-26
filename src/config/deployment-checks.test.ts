import { describe, expect, it } from "vitest";
import { checkDeploymentConfig } from "./deployment-checks";

const production = {
  NEXT_PUBLIC_SITE_URL: "https://carrefourdespossibles.ci",
  NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  INTERNAL_STATUS_TOKEN: "x".repeat(32),
  CRON_SECRET: "y".repeat(32),
  EMAIL_PROVIDER: "resend",
  EMAIL_API_KEY: "re_x",
  EMAIL_FROM: "bonjour@carrefourdespossibles.ci",
};

const variables = (issues: ReturnType<typeof checkDeploymentConfig>, level: "error" | "warning") =>
  issues.filter((issue) => issue.level === level).map((issue) => issue.variable);

describe("contrôle de la configuration de déploiement", () => {
  it("accepte une production complète", () => {
    expect(checkDeploymentConfig(production, "production")).toEqual([]);
  });

  it("refuse les réglages de test, une adresse non HTTPS et l'absence de clé secrète", () => {
    const issues = checkDeploymentConfig({ ...production, NEXT_PUBLIC_SITE_URL: "http://localhost:3000", SUPABASE_SECRET_KEY: "", RATE_LIMIT_SCALE: "50" }, "production");
    expect(variables(issues, "error")).toEqual(["NEXT_PUBLIC_SITE_URL", "SUPABASE_SECRET_KEY", "RATE_LIMIT_SCALE"]);
  });

  it("signale les accès d'administration laissés dans l'application et l'IA sans plafond", () => {
    const issues = checkDeploymentConfig({ ...production, SUPABASE_ACCESS_TOKEN: "sbp_x", AI_PROVIDER: "anthropic", AI_API_KEY: "k" }, "production");
    expect(variables(issues, "warning")).toEqual(["SUPABASE_ACCESS_TOKEN", "AI_MONTHLY_BUDGET_EUR"]);
  });

  it("exige qu'une préproduction se déclare comme telle", () => {
    expect(variables(checkDeploymentConfig(production, "preview"), "error")).toEqual(["APP_ENV"]);
    expect(checkDeploymentConfig({ ...production, APP_ENV: "preview", SITE_ACCESS_CODE: "code-de-test-123" }, "preview")).toEqual([]);
  });

  it("ne cite jamais la valeur d'une variable", () => {
    const issues = checkDeploymentConfig({ ...production, SUPABASE_SECRET_KEY: "", RATE_LIMIT_SCALE: "valeur-secrete" }, "production");
    expect(JSON.stringify(issues)).not.toContain("valeur-secrete");
    expect(JSON.stringify(issues)).not.toContain("sb_publishable_x");
  });

  it("reste indulgent en développement", () => {
    expect(variables(checkDeploymentConfig({}, "development"), "error")).toEqual([]);
  });
});
