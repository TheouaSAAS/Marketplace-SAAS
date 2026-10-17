// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canTransition, CONTENT_STATUSES, CONTENT_STATUS_META, type ContentStatus } from "./content-status";
import type { Actor } from "./roles";

const securitySql = readFileSync(
  new URL("../../supabase/migrations/20261017000200_security.sql", import.meta.url),
  "utf8",
);

/** Extrait les couples (de, vers) d'un bloc « -- BEGIN nom … -- END nom » de la migration. */
function sqlPairs(block: string): string[] {
  const match = securitySql.match(new RegExp(`-- BEGIN ${block}([\\s\\S]*?)-- END ${block}`));
  if (!match) throw new Error(`Bloc ${block} introuvable dans la migration`);
  return [...match[1].matchAll(/\('(\w+)', '(\w+)'\)/g)].map(([, from, to]) => `${from}>${to}`).sort();
}

function tsPairs(context: { actor: Actor; isOwner: boolean }): string[] {
  const pairs: string[] = [];
  for (const from of CONTENT_STATUSES) {
    for (const to of CONTENT_STATUSES) {
      if (canTransition(from, to, context)) pairs.push(`${from}>${to}`);
    }
  }
  return pairs.sort();
}

describe("canTransition", () => {
  it("permet à l'auteur de soumettre son brouillon, jamais de se publier lui-même", () => {
    const owner = { actor: "user" as const, isOwner: true };
    expect(canTransition("draft", "pending", owner)).toBe(true);
    expect(canTransition("draft", "published", owner)).toBe(false);
    expect(canTransition("pending", "published", owner)).toBe(false);
  });

  it("permet à l'auteur de retirer une publication", () => {
    expect(canTransition("published", "archived", { actor: "professional", isOwner: true })).toBe(true);
  });

  it("réserve la publication et le rejet à la modération", () => {
    expect(canTransition("pending", "published", { actor: "moderator", isOwner: false })).toBe(true);
    expect(canTransition("pending", "rejected", { actor: "admin", isOwner: false })).toBe(true);
    expect(canTransition("pending", "rejected", { actor: "user", isOwner: false })).toBe(false);
  });

  it("refuse tout à un visiteur et à un tiers", () => {
    for (const from of CONTENT_STATUSES) {
      for (const to of CONTENT_STATUSES) {
        expect(canTransition(from, to, { actor: "visitor", isOwner: true })).toBe(false);
        expect(canTransition(from, to, { actor: "user", isOwner: false })).toBe(false);
      }
    }
  });

  it("refuse une « transition » vers le même statut", () => {
    expect(canTransition("draft", "draft", { actor: "admin", isOwner: true })).toBe(false);
  });
});

describe("cohérence avec la base de données", () => {
  it("la matrice propriétaire est identique au déclencheur SQL", () => {
    expect(tsPairs({ actor: "user", isOwner: true })).toEqual(sqlPairs("owner_transitions"));
  });

  it("la matrice modération est identique au déclencheur SQL", () => {
    expect(tsPairs({ actor: "moderator", isOwner: false })).toEqual(sqlPairs("staff_transitions"));
  });

  it("chaque statut SQL a un libellé français", () => {
    const enumMatch = readFileSync(
      new URL("../../supabase/migrations/20261017000100_schema.sql", import.meta.url),
      "utf8",
    ).match(/create type public\.content_status as enum \(([^)]+)\)/);
    const sqlStatuses = [...(enumMatch?.[1].matchAll(/'(\w+)'/g) ?? [])].map(([, value]) => value);
    expect(sqlStatuses).toEqual([...CONTENT_STATUSES]);
    for (const status of sqlStatuses) expect(CONTENT_STATUS_META[status as ContentStatus].label).toBeTruthy();
  });
});
