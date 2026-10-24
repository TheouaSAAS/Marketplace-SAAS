import { describe, expect, it } from "vitest";
import { LIVE_DEBOUNCE_MS, LIVE_MIN_GAP_MS, nextRefreshDelay } from "./live";

describe("rechargements en direct", () => {
  it("regroupe les changements reçus en rafale", () => {
    expect(nextRefreshDelay(0, 60_000)).toBe(LIVE_DEBOUNCE_MS);
  });

  it("espace deux rechargements d'au moins dix secondes", () => {
    expect(nextRefreshDelay(100_000, 102_000)).toBe(LIVE_MIN_GAP_MS - 2_000);
    expect(nextRefreshDelay(100_000, 100_000 + LIVE_MIN_GAP_MS)).toBe(LIVE_DEBOUNCE_MS);
  });
});
