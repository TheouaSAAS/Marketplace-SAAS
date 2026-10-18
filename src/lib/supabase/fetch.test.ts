// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetch";

/** Simule un serveur qui ne répond jamais, mais respecte l'annulation. */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("interrompt un appel qui ne répond pas", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    await expect(fetchWithTimeout("https://exemple.invalid", undefined, 20)).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("respecte aussi l'annulation demandée par l'appelant", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const pending = fetchWithTimeout("https://exemple.invalid", { signal: controller.signal }, 10_000);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("laisse passer une réponse rapide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    await expect((await fetchWithTimeout("https://exemple.invalid")).text()).resolves.toBe("ok");
  });
});
