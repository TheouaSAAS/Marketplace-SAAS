import { describe, expect, it } from "vitest";
import { effectiveRole, isBackOffice, USER_ROLES } from "./roles";

describe("rôle effectif et second facteur", () => {
  it("n'accorde les droits du back-office qu'après le second facteur", () => {
    expect(effectiveRole("admin", "aal1", true)).toBe("user");
    expect(effectiveRole("moderator", undefined, true)).toBe("user");
    expect(effectiveRole("superadmin", "aal2", true)).toBe("superadmin");
  });

  it("laisse les membres et professionnels inchangés", () => {
    expect(effectiveRole("user", "aal1", true)).toBe("user");
    expect(effectiveRole("professional", "aal1", true)).toBe("professional");
  });

  it("n'exige rien quand la plateforme ne l'impose pas", () => {
    expect(effectiveRole("admin", "aal1", false)).toBe("admin");
  });

  it("classe les rôles du back-office", () => {
    expect(USER_ROLES.filter(isBackOffice)).toEqual(["local_editor", "moderator", "admin", "superadmin"]);
  });
});
