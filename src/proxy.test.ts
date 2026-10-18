// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const request = (path: string, cookies: Record<string, string> = {}) => {
  const req = new NextRequest(`http://localhost:3000${path}`);
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy — maintenance", () => {
  it("sert la page de maintenance avec un code 503 quand le mode est activé", async () => {
    vi.stubEnv("FEATURE_MAINTENANCE", "on");
    const response = await proxy(request("/annonces"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    expect(response.headers.get("retry-after")).toBe("600");
  });

  it("laisse passer la supervision pendant la maintenance", async () => {
    vi.stubEnv("FEATURE_MAINTENANCE", "on");
    vi.stubEnv("NODE_ENV", "development");
    for (const path of ["/api/health", "/interne/statut", "/maintenance"]) {
      const response = await proxy(request(path));
      expect(response.status, path).not.toBe(503);
    }
  });

  it("n'intervient pas hors maintenance", async () => {
    const response = await proxy(request("/annonces"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("proxy — espaces protégés", () => {
  it.each(["/profil", "/favoris", "/espace-pro", "/admin/utilisateurs"])("redirige %s vers la connexion sans session", async (path) => {
    const response = await proxy(request(path));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/connexion");
    expect(location.searchParams.get("suivant")).toBe(path);
  });

  it("ne protège pas une page publique au nom proche", async () => {
    const response = await proxy(request("/profils-publics"));
    expect(response.status).toBe(200);
  });
});

describe("proxy — pages internes", () => {
  it("répond 404 sans jeton en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_STATUS_TOKEN", "x".repeat(32));
    const response = await proxy(request("/interne/statut"));
    expect(response.headers.get("x-middleware-rewrite")).toContain("/__introuvable");
  });

  it("sert la page avec le bon jeton, sans cache ni indexation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("INTERNAL_STATUS_TOKEN", "x".repeat(32));
    const response = await proxy(request(`/interne/statut?token=${"x".repeat(32)}`));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
