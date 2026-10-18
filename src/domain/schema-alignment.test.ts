import { describe, expect, it } from "vitest";
import { Constants } from "@/types/database";
import { CONTENT_STATUSES } from "./content-status";
import { assignableRoles, isCurator, isStaff, USER_ROLES } from "./roles";
import { VERIFICATION_STATUSES } from "./verification";

/**
 * Les constantes du domaine doivent correspondre exactement aux types de la
 * base réelle (src/types/database.ts, généré par `npm run db:types`).
 */
describe("alignement domaine ↔ base de données", () => {
  const enums = Constants.public.Enums;

  it("rôles", () => {
    expect([...USER_ROLES]).toEqual([...enums.user_role]);
  });

  it("statuts de modération", () => {
    expect([...CONTENT_STATUSES]).toEqual([...enums.content_status]);
  });

  it("statuts de vérification", () => {
    expect([...VERIFICATION_STATUSES]).toEqual([...enums.verification_status]);
  });
});

describe("répartition des rôles", () => {
  it("sépare modération et vérification des données locales", () => {
    expect(isStaff("moderator")).toBe(true);
    expect(isCurator("moderator")).toBe(false);
    expect(isCurator("local_editor")).toBe(true);
    expect(isStaff("local_editor")).toBe(false);
  });

  it("réserve la nomination des administrateurs au superadministrateur", () => {
    expect(assignableRoles("admin")).not.toContain("admin");
    expect(assignableRoles("superadmin")).toContain("admin");
    expect(assignableRoles("moderator")).toEqual([]);
  });
});
