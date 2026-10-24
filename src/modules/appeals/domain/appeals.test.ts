import { describe, expect, it } from "vitest";
import { latestAppeal, type MyAppeal } from "./appeals";

const appeals: MyAppeal[] = [
  { targetType: "listing", targetId: "a", status: "rejected", decisionNote: "Photos toujours absentes" },
  { targetType: "listing", targetId: "a", status: "accepted", decisionNote: "Ancien recours" },
  { targetType: "account", targetId: "b", status: "pending", decisionNote: null },
];

describe("recours", () => {
  it("retient le plus récent recours d'un contenu (liste triée du plus récent au plus ancien)", () => {
    expect(latestAppeal(appeals, "listing", "a")?.decisionNote).toBe("Photos toujours absentes");
    expect(latestAppeal(appeals, "account", "b")?.status).toBe("pending");
  });

  it("ne confond pas les types de contenu", () => {
    expect(latestAppeal(appeals, "event", "a")).toBeNull();
  });
});
