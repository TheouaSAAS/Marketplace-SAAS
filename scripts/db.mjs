#!/usr/bin/env node
/**
 * Outil de base de données (poste de développement / CI).
 *
 *   node scripts/db.mjs status            état de la base, sans écriture
 *   node scripts/db.mjs migrate           applique les migrations en attente
 *   node scripts/db.mjs seed <fichier…>   exécute des fichiers de données (idempotents)
 *   node scripts/db.mjs sql <fichier>     exécute un fichier SQL et affiche le résultat (vérifications)
 *
 * Deux modes de connexion (lus dans .env.local) :
 *  - DATABASE_URL : connexion PostgreSQL directe ou via le pooler ;
 *  - SUPABASE_ACCESS_TOKEN : API d'administration Supabase (HTTPS), utile si
 *    le port 5432 est inaccessible ou le mot de passe indisponible.
 *
 * Chaque migration est appliquée dans une transaction explicite (tout ou rien)
 * et tracée dans supabase_migrations.schema_migrations (table de la CLI Supabase).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

const migrationsDir = join(root, "supabase", "migrations");

/** Lit un fichier SQL en retirant l'éventuel BOM UTF-8 (ajouté par certains éditeurs Windows). */
function readSql(path) {
  return readFileSync(path, "utf8").replace(/^﻿/, "");
}

/** Encadre un texte en chaîne SQL littérale sûre (dollar-quoting avec étiquette absente du texte). */
function dollarQuote(text) {
  let tag = "cdp";
  while (text.includes(`$${tag}$`)) tag += "_x";
  return `$${tag}$${text}$${tag}$`;
}

async function createPgTransport(url) {
  const { default: pg } = await import("pg");
  const ca = process.env.DATABASE_CA_CERT ? readFileSync(process.env.DATABASE_CA_CERT, "utf8") : undefined;
  const client = new pg.Client({
    connectionString: url,
    ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    application_name: "carrefour-des-possibles-db",
  });
  await client.connect();
  return {
    label: "connexion PostgreSQL",
    async query(sql) {
      const result = await client.query(sql);
      const last = Array.isArray(result) ? result[result.length - 1] : result;
      return last?.rows ?? [];
    },
    end: () => client.end(),
  };
}

function createApiTransport(token) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL absente : impossible de déduire le projet.");
  const ref = new URL(projectUrl).hostname.split(".")[0];
  return {
    label: `API d'administration (projet ${ref})`,
    async query(sql) {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "carrefour-des-possibles-db/0.1" },
        body: JSON.stringify({ query: sql }),
      });
      const body = await response.text();
      if (!response.ok) {
        let message = body;
        try {
          message = JSON.parse(body).message ?? body;
        } catch {}
        throw new Error(`HTTP ${response.status} : ${message}`);
      }
      return body ? JSON.parse(body) : [];
    },
    end: async () => {},
  };
}

async function connect() {
  if (process.env.DATABASE_URL?.startsWith("postgres")) return createPgTransport(process.env.DATABASE_URL);
  if (process.env.SUPABASE_ACCESS_TOKEN) return createApiTransport(process.env.SUPABASE_ACCESS_TOKEN);
  throw new Error("Renseigner DATABASE_URL ou SUPABASE_ACCESS_TOKEN dans .env.local.");
}

function localMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => /^\d{14}_.+\.sql$/.test(file))
    .sort()
    .map((file) => ({ file, version: file.slice(0, 14), name: file.slice(15, -4) }));
}

async function appliedVersions(db) {
  // La table est résolue à l'analyse de la requête : vérifier son existence d'abord.
  const [exists] = await db.query(`select to_regclass('supabase_migrations.schema_migrations') is not null as present`);
  if (!exists?.present) return new Set();
  const rows = await db.query(`select version from supabase_migrations.schema_migrations`);
  return new Set(rows.map((row) => row.version));
}

async function status(db) {
  const [info] = await db.query(`select version() as v, current_user as u, current_database() as d`);
  console.log(`Serveur : ${String(info.v).split(",")[0]}`);
  console.log(`Base : ${info.d} — rôle : ${info.u}`);
  const extensions = await db.query(
    `select name, installed_version from pg_available_extensions
     where name in ('postgis','unaccent','pg_trgm','vector','pg_cron') order by name`,
  );
  console.log(
    `Extensions : ${extensions.map((e) => `${e.name}${e.installed_version ? ` (installée ${e.installed_version})` : " (disponible)"}`).join(", ")}`,
  );
  const tables = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
  );
  console.log(`Tables du schéma public : ${tables.length ? tables.map((t) => t.table_name).join(", ") : "aucune"}`);
  const applied = await appliedVersions(db);
  for (const migration of localMigrations()) {
    console.log(`  ${applied.has(migration.version) ? "✓ appliquée " : "… en attente"}  ${migration.file}`);
  }
}

async function migrate(db) {
  const applied = await appliedVersions(db);
  const pending = localMigrations().filter((migration) => !applied.has(migration.version));
  if (pending.length === 0) {
    console.log("Aucune migration en attente.");
    return;
  }
  for (const migration of pending) {
    const sql = readSql(join(migrationsDir, migration.file));
    process.stdout.write(`→ ${migration.file} … `);
    try {
      await db.query(`begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${migration.version}', '${migration.name}', array[${dollarQuote(sql)}]);
commit;`);
      console.log("appliquée");
    } catch (error) {
      await db.query("rollback").catch(() => {});
      console.log("ÉCHEC (transaction annulée, base inchangée)");
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
  }
}

async function runFiles(db, files, { print = false } = {}) {
  if (files.length === 0) throw new Error("Préciser au moins un fichier SQL.");
  for (const file of files) {
    const sql = readSql(join(root, file));
    process.stdout.write(`→ ${file} … `);
    try {
      const rows = await db.query(print ? sql : `begin;\n${sql}\n;\ncommit;`);
      console.log("exécuté");
      if (print) console.log(JSON.stringify(rows, null, 2));
    } catch (error) {
      await db.query("rollback").catch(() => {});
      console.log("ÉCHEC (annulé)");
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
  }
}

/**
 * Exécute les suites de supabase/tests/*.sql. Chaque suite s'exécute dans une
 * transaction annulée et renvoie des lignes { test, ok, detail }.
 */
async function verify(db) {
  const dir = join(root, "supabase", "tests");
  let failures = 0;
  let total = 0;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    console.log(`\n${file}`);
    const rows = await db.query(readSql(join(dir, file)));
    for (const row of rows) {
      total += 1;
      if (!row.ok) failures += 1;
      console.log(`  ${row.ok ? "✓" : "✗"} ${row.test}${row.ok ? "" : ` — obtenu : ${row.detail ?? "null"}`}`);
    }
  }
  console.log(`\n${total - failures}/${total} vérifications réussies.`);
  if (failures > 0 || total === 0) process.exitCode = 1;
}

/** Génère src/types/database.ts depuis le schéma réel (API d'administration). */
async function generateTypes() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN requis pour générer les types.");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "carrefour-des-possibles-db/0.1" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} : ${await response.text()}`);
  const { types } = await response.json();
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(join(root, "src", "types"), { recursive: true });
  const header = "// Fichier GÉNÉRÉ par `npm run db:types` depuis le schéma Supabase. Ne pas modifier à la main.\n\n";
  writeFileSync(join(root, "src", "types", "database.ts"), header + types);
  console.log(`src/types/database.ts généré (${types.split("\n").length} lignes).`);
}

/**
 * Applique la configuration d'authentification versionnée (configuration as code) :
 * adresse du site, redirections autorisées, politique de mot de passe, e-mails en français.
 */
async function applyAuthConfig() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN requis pour configurer l'authentification.");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const template = (name) => readFileSync(join(root, "supabase", "templates", name), "utf8");

  const desired = {
    site_url: siteUrl,
    uri_allow_list: `${siteUrl}/**`,
    password_min_length: 10,
    password_required_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
    security_update_password_require_reauthentication: true,
    mailer_secure_email_change_enabled: true,
    mailer_otp_exp: 3600,
    mailer_subjects_confirmation: "Confirmez votre adresse e-mail — Carrefour des Possibles",
    mailer_templates_confirmation_content: template("confirmation.html"),
    mailer_subjects_recovery: "Réinitialisation de votre mot de passe — Carrefour des Possibles",
    mailer_templates_recovery_content: template("recovery.html"),
    mailer_subjects_email_change: "Confirmez votre nouvelle adresse e-mail — Carrefour des Possibles",
    mailer_templates_email_change_content: template("email-change.html"),
  };

  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "carrefour-des-possibles-db/0.1" };
  const current = await (await fetch(url, { headers })).json();
  // Offre gratuite + e-mail Supabase par défaut : modèles non modifiables sans SMTP personnalisé.
  if (!current.smtp_host) {
    for (const key of Object.keys(desired)) if (key.startsWith("mailer_subjects_") || key.startsWith("mailer_templates_")) delete desired[key];
    console.log("Aucun SMTP personnalisé : modèles d'e-mails français NON appliqués (e-mails Supabase par défaut, en anglais).");
  }
  const changes = Object.keys(desired).filter((key) => current[key] !== desired[key]);
  if (changes.length === 0) {
    console.log("Configuration d'authentification déjà à jour.");
    return;
  }
  const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(desired) });
  if (!response.ok) throw new Error(`HTTP ${response.status} : ${await response.text()}`);
  console.log(`Configuration d'authentification mise à jour (${changes.length} réglage(s)) :`);
  for (const key of changes) {
    const shown = key.includes("templates") ? "(modèle d'e-mail)" : JSON.stringify(desired[key]);
    console.log(`  ${key} : ${key.includes("templates") ? "" : `${JSON.stringify(current[key])} → `}${shown}`);
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === "auth-config") {
  try {
    await applyAuthConfig();
  } catch (error) {
    console.error(`Configuration impossible : ${error.message}`);
    process.exitCode = 1;
  }
  process.exit();
}
if (command === "types") {
  try {
    await generateTypes();
  } catch (error) {
    console.error(`Génération impossible : ${error.message}`);
    process.exitCode = 1;
  }
  process.exit();
}
let db;
try {
  db = await connect();
  console.log(`Via ${db.label}`);
  if (command === "status") await status(db);
  else if (command === "migrate") await migrate(db);
  else if (command === "seed") await runFiles(db, args);
  else if (command === "sql") await runFiles(db, args, { print: true });
  else if (command === "verify") await verify(db);
  else {
    console.error("Commande attendue : status | migrate | seed <fichier…> | sql <fichier>");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Connexion ou exécution impossible : ${error.message}`);
  process.exitCode = 1;
} finally {
  await db?.end().catch(() => {});
}
