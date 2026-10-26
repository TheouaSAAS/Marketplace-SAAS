import { describe, expect, it } from "vitest";
import { isIndexableEnvironment, resolveAppEnvironment } from "./environment";

describe("environnement de déploiement", () => {
  it("suit APP_ENV quand il est déclaré", () => {
    expect(resolveAppEnvironment({ APP_ENV: "preview", NODE_ENV: "production", VERCEL_ENV: "production" })).toBe("preview");
  });

  it("reprend l'environnement de l'hébergeur, sinon le mode de compilation", () => {
    expect(resolveAppEnvironment({ VERCEL_ENV: "preview", NODE_ENV: "production" })).toBe("preview");
    expect(resolveAppEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(resolveAppEnvironment({ NODE_ENV: "development" })).toBe("development");
    expect(resolveAppEnvironment({ APP_ENV: "recette", NODE_ENV: "test" })).toBe("development");
  });

  it("n'autorise l'indexation qu'en production", () => {
    expect(isIndexableEnvironment("production")).toBe(true);
    expect(isIndexableEnvironment("preview")).toBe(false);
    expect(isIndexableEnvironment("development")).toBe(false);
  });
});
