import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { shouldAlert } = await import("./error-reporting");

describe("alertes d'erreurs serveur", () => {
  it("n'envoie qu'une alerte par erreur toutes les dix minutes", () => {
    const sent = new Map<string, number>();
    expect(shouldAlert("abc", 0, sent)).toBe(true);
    expect(shouldAlert("abc", 5 * 60_000, sent)).toBe(false);
    expect(shouldAlert("autre", 5 * 60_000, sent)).toBe(true);
    expect(shouldAlert("abc", 10 * 60_000, sent)).toBe(true);
  });
});
