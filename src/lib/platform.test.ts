// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { canViewInternalStatus } from "@/server/internal-access";
import { publicEnvSchema } from "./env";
import { serverEnvSchema } from "./env.server";
import { AppError, fail, toPublicError } from "./errors";
import { createLogger, REDACTED, redact } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("séparation des variables d'environnement", () => {
  it("n'expose au navigateur que des variables NEXT_PUBLIC_", () => {
    for (const name of Object.keys(publicEnvSchema.shape)) expect(name).toMatch(/^NEXT_PUBLIC_/);
  });

  it("ne déclare aucun secret avec le préfixe public", () => {
    for (const name of Object.keys(serverEnvSchema.shape)) expect(name).not.toMatch(/^NEXT_PUBLIC_/);
  });
});

describe("journal structuré", () => {
  it("masque secrets, contacts et coordonnées à toute profondeur", () => {
    const output = redact({
      user: { email: "a@b.ci", phone: "+225", name: "Awa" },
      position: { lat: 4.7, lng: -6.6 },
      api_key: "sk",
      relationship: "conservé",
      items: [{ token: "t" }],
    }) as {
      user: { email: unknown; phone: unknown; name: unknown };
      position: unknown;
      api_key: unknown;
      relationship: unknown;
      items: { token: unknown }[];
    };
    expect(output.user.email).toBe(REDACTED);
    expect(output.user.phone).toBe(REDACTED);
    expect(output.user.name).toBe("Awa");
    expect(output.position).toBe(REDACTED);
    expect(output.api_key).toBe(REDACTED);
    expect(output.relationship).toBe("conservé");
    expect(output.items[0]?.token).toBe(REDACTED);
  });

  it("écrit une ligne JSON et respecte le niveau minimal", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createLogger({ module: "test" });
    logger.info("ignoré");
    logger.warn("retenu", { secret: "x" });
    expect(log).not.toHaveBeenCalled();
    const entry = JSON.parse(String(warn.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({ level: "warn", msg: "retenu", module: "test", secret: REDACTED });
  });
});

describe("erreurs publiques", () => {
  it("transmet le message d'une erreur attendue", () => {
    expect(toPublicError(new AppError("forbidden"))).toEqual({
      code: "forbidden",
      message: "Vous n’avez pas l’autorisation d’effectuer cette action.",
      fieldErrors: undefined,
    });
  });

  it("ne divulgue jamais le détail d'une erreur inattendue", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toPublicError(new Error('relation "listings" does not exist'));
    expect(result.code).toBe("internal");
    expect(result.message).not.toMatch(/listings/);
  });

  it("produit un résultat d'action en échec", () => {
    expect(fail("validation", undefined, { title: ["Trop court"] })).toEqual({
      ok: false,
      error: { code: "validation", message: "Certaines informations sont invalides.", fieldErrors: { title: ["Trop court"] } },
    });
  });
});

describe("accès au statut interne", () => {
  const token = "x".repeat(32);

  it("exige le jeton exact lorsqu'il est configuré", () => {
    expect(canViewInternalStatus(token, token)).toBe(true);
    expect(canViewInternalStatus("x".repeat(31), token)).toBe(false);
    expect(canViewInternalStatus(undefined, token)).toBe(false);
  });

  it("sans jeton configuré, refuse en production et autorise en développement", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(canViewInternalStatus(undefined, undefined)).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(canViewInternalStatus(undefined, undefined)).toBe(true);
  });
});
