import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import { ADMIN_SECTIONS, auditLabel, canAccess, contentHref, historyHref, reportTargetHref, revisionChanges, sectionsFor } from "./back-office";

const tools = (role: Parameters<typeof sectionsFor>[0]) => sectionsFor(role).flatMap((section) => section.tools.map((tool) => tool.route));

describe("accès au back-office", () => {
  it("ne donne aux modérateurs aucun outil d'administration des comptes", () => {
    expect(tools("moderator")).toContain("adminReports");
    expect(tools("moderator")).not.toContain("adminAccounts");
    expect(tools("moderator")).not.toContain("adminCategories");
    expect(tools("moderator")).not.toContain("adminDuplicates");
  });

  it("réserve les données locales à l'équipe locale, sans les signalements", () => {
    expect(tools("local_editor")).toEqual(expect.arrayContaining(["adminDuplicates", "adminSources", "adminQuality", "adminGuide"]));
    expect(tools("local_editor")).not.toContain("adminReports");
  });

  it("n'ouvre rien aux membres et professionnels", () => {
    expect(sectionsFor("user")).toEqual([]);
    expect(sectionsFor("professional")).toEqual([]);
    expect(canAccess("visitor", "team")).toBe(false);
  });

  it("donne tout à l'administrateur", () => {
    const all = ADMIN_SECTIONS.flatMap((section) => section.tools.map((tool) => tool.route));
    expect(tools("admin")).toEqual(all);
  });

  it("ne pointe que vers des pages existantes", () => {
    for (const section of ADMIN_SECTIONS) for (const tool of section.tools) expect(ROUTES[tool.route].status).toBe("live");
  });
});

describe("liens vers les contenus", () => {
  it("mène au contenu signalé, ou à son support pour un commentaire ou un avis", () => {
    expect(reportTargetHref({ type: "listing", slug: "velo", parentType: null, parentSlug: null })).toBe("/annonces/velo");
    expect(reportTargetHref({ type: "comment", slug: null, parentType: "listing", parentSlug: "velo" })).toBe("/annonces/velo");
    expect(reportTargetHref({ type: "review", slug: null, parentType: "place", parentSlug: "maquis" })).toBe("/lieux/maquis");
    expect(reportTargetHref({ type: "review", slug: null, parentType: "business", parentSlug: "plombier" })).toBe("/professionnels/plombier");
    expect(reportTargetHref({ type: "article", slug: "eau", parentType: "guide_section", parentSlug: "demarches" })).toBe("/guide/demarches/eau");
    expect(reportTargetHref({ type: "message", slug: null, parentType: null, parentSlug: null })).toBeNull();
  });

  it("relie un quartier à sa fiche d'administration et chaque contenu à son historique", () => {
    expect(contentHref("neighborhood", "cite")).toBe("/admin/quartiers/cite");
    expect(historyHref("business", "abc")).toBe("/admin/journal?type=business_profiles&id=abc");
    expect(historyHref("message", "abc")).toBeNull();
  });
});

describe("historique", () => {
  it("ne garde que les champs réellement modifiés, sans bruit technique", () => {
    const changes = revisionChanges(
      { status: "published", title: "Vélo", updated_at: "a", search_vector: "x", rejection_reason: null },
      { status: "rejected", title: "Vélo", updated_at: "b", search_vector: "y", rejection_reason: "Arnaque" },
    );
    expect(changes).toEqual([
      { field: "status", label: "Statut", before: "published", after: "rejected" },
      { field: "rejection_reason", label: "Motif", before: "—", after: "Arnaque" },
    ]);
  });

  it("présente une création et une suppression", () => {
    expect(revisionChanges(null, { name: "Maquis" })).toEqual([{ field: "name", label: "Nom", before: "—", after: "Maquis" }]);
    expect(revisionChanges({ name: "Maquis" }, null)[0]?.after).toBe("—");
  });

  it("abrège les longues valeurs", () => {
    const [change] = revisionChanges({ body: "" }, { body: "x".repeat(400) });
    expect(change?.after.length).toBe(160);
  });

  it("traduit les actions connues et garde les autres telles quelles", () => {
    expect(auditLabel("compte.suspension")).toBe("Compte suspendu");
    expect(auditLabel("inconnue.action")).toBe("inconnue.action");
  });
});
