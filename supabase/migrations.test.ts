// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadModule, parsePlPgSQLSync, parseSync } from "libpg-query";

/**
 * Validation statique des fichiers SQL avec le parseur officiel de PostgreSQL
 * (libpg_query). Ne remplace pas l'exécution sur une vraie base, mais détecte
 * toute erreur de syntaxe SQL ou PL/pgSQL avant le déploiement.
 */

const root = fileURLToPath(new URL(".", import.meta.url));
const migrationsDir = join(root, "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({ file, sql: readFileSync(join(migrationsDir, file), "utf8") }));
const seeds = [
  { file: "seed.sql", sql: readFileSync(join(root, "seed.sql"), "utf8") },
  ...readdirSync(join(root, "seeds"))
    .filter((file) => file.endsWith(".sql"))
    .map((file) => ({ file: `seeds/${file}`, sql: readFileSync(join(root, "seeds", file), "utf8") })),
];
const allSchemaSql = migrations.map((migration) => migration.sql).join("\n");

beforeAll(async () => {
  await loadModule();
});

describe("migrations", () => {
  it("sont nommées par horodatage et dans l'ordre", () => {
    for (const { file } of migrations) expect(file).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
  });

  it.each([...migrations, ...seeds])("$file : syntaxe SQL valide", ({ sql }) => {
    expect(() => parseSync(sql)).not.toThrow();
  });

  it.each(migrations)("$file : corps PL/pgSQL valides", ({ sql }) => {
    expect(() => parsePlPgSQLSync(sql)).not.toThrow();
  });

  it("active la RLS sur chaque table publique", () => {
    const tables = [...allSchemaSql.matchAll(/create table public\.(\w+)/g)].map(([, name]) => name);
    expect(tables.length).toBeGreaterThan(15);
    for (const table of tables) {
      expect(allSchemaSql, `RLS manquante sur ${table}`).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("définit au moins une règle de lecture pour chaque table exposée à l'API", () => {
    const tables = [...allSchemaSql.matchAll(/create table public\.(\w+)/g)].map(([, name]) => name);
    for (const table of tables) {
      expect(allSchemaSql, `aucune policy sur ${table}`).toMatch(new RegExp(`create policy \\w+ on public\\.${table} `));
    }
  });

  it("fixe le search_path de chaque fonction (protection contre le détournement de schéma)", () => {
    const functions = allSchemaSql.split(/create or replace function /).slice(1);
    expect(functions.length).toBeGreaterThan(5);
    for (const fn of functions) {
      const name = fn.slice(0, fn.indexOf("("));
      expect(fn.slice(0, fn.indexOf("$$")), `search_path absent : ${name}`).toMatch(/set search_path = ''/);
    }
  });

  it("ne stocke aucune position personnelle de visiteur", () => {
    expect(allSchemaSql).not.toMatch(/user_locations|visitor_position|location_history/i);
  });
});
