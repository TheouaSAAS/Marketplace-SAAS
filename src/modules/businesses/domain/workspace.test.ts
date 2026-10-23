import { describe, expect, it } from "vitest";
import { publicationSteps, workspaceRights } from "./workspace";

describe("étapes de publication", () => {
  it("guide une page incomplète en brouillon", () => {
    const steps = publicationSteps({ status: "draft", complete: false, missing: ["Des horaires"], verified: false, verificationPending: false });
    expect(steps.map((step) => step.done)).toEqual([false, false, false, false]);
    expect(steps[0]!.hint).toContain("des horaires");
    expect(steps[3]!.hint).toContain("une fois la page publiée");
  });

  it("explique un refus et une vérification en cours", () => {
    expect(publicationSteps({ status: "rejected", complete: true, missing: [], verified: false, verificationPending: false })[1]!.hint).toContain("corrigez");
    const published = publicationSteps({ status: "published", complete: true, missing: [], verified: false, verificationPending: true });
    expect(published.map((step) => step.done)).toEqual([true, true, true, true]);
  });
});

describe("droits par rôle", () => {
  it("un lecteur consulte, un éditeur agit, un administrateur gère l'équipe", () => {
    expect(workspaceRights("viewer")).toEqual({ canManageListings: false, canHandleRequests: false, canManageTeam: false });
    expect(workspaceRights("editor")).toEqual({ canManageListings: true, canHandleRequests: true, canManageTeam: false });
    expect(workspaceRights("admin").canManageTeam).toBe(true);
  });
});
