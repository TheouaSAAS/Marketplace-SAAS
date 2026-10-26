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
import { join, resolve } from "node:path";
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
    const sql = readSql(resolve(root, file));
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
 * Serveur d'envoi des e-mails d'authentification (SMTP personnalisé de Supabase), déduit de
 * l'environnement : variables AUTH_SMTP_* explicites, sinon le fournisseur d'e-mails de la
 * plateforme (EMAIL_PROVIDER=resend : smtp.resend.com, la clé d'API sert de mot de passe).
 * Null si rien n'est configuré : Supabase garde son envoi par défaut (limité, équipe seulement).
 */
function smtpFromEnv() {
  const from = process.env.EMAIL_FROM?.trim();
  if (process.env.AUTH_SMTP_HOST && process.env.AUTH_SMTP_PASS) {
    return {
      host: process.env.AUTH_SMTP_HOST,
      port: process.env.AUTH_SMTP_PORT ?? "465",
      user: process.env.AUTH_SMTP_USER ?? "",
      pass: process.env.AUTH_SMTP_PASS,
      from: process.env.AUTH_SMTP_FROM ?? from,
    };
  }
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.EMAIL_API_KEY && from) {
    return { host: "smtp.resend.com", port: "465", user: "resend", pass: process.env.EMAIL_API_KEY, from };
  }
  return null;
}

/** Réglages qui ne s'affichent jamais, même en partie. */
const SECRET_SETTINGS = new Set(["smtp_pass"]);

/**
 * Applique la configuration d'authentification versionnée (configuration as code) :
 * adresse du site, redirections autorisées, politique de mot de passe, second facteur,
 * serveur d'envoi et e-mails en français. `--dry-run` : affiche les changements sans les appliquer.
 */
async function applyAuthConfig({ dryRun = false } = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN requis pour configurer l'authentification.");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const template = (name) => readFileSync(join(root, "supabase", "templates", name), "utf8");
  // Adresses supplémentaires autorisées après un lien d'e-mail (préproduction, domaine secondaire), séparées par des virgules.
  const extraUrls = (process.env.AUTH_REDIRECT_URLS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter((value) => /^https?:\/\//.test(value));

  const desired = {
    site_url: siteUrl,
    uri_allow_list: [siteUrl, ...extraUrls].map((value) => `${value}/**`).join(","),
    // Inscription ouverte, adresse confirmée obligatoire (aucune connexion avant confirmation).
    disable_signup: false,
    mailer_autoconfirm: false,
    password_min_length: 10,
    password_required_characters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
    security_update_password_require_reauthentication: true,
    mailer_secure_email_change_enabled: true,
    // Liens à usage unique valables une heure.
    mailer_otp_exp: 3600,
    // Sessions : rotation des jetons de rafraîchissement, réutilisation tolérée 10 s (onglets simultanés).
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    // Second facteur TOTP (exigé par la plateforme pour le back-office) ; SMS et WebAuthn non utilisés.
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true,
    mfa_phone_enroll_enabled: false,
    mfa_phone_verify_enabled: false,
    mfa_max_enrolled_factors: 10,
    mailer_subjects_confirmation: "Confirmez votre adresse e-mail — Carrefour des Possibles",
    mailer_templates_confirmation_content: template("confirmation.html"),
    mailer_subjects_recovery: "Réinitialisation de votre mot de passe — Carrefour des Possibles",
    mailer_templates_recovery_content: template("recovery.html"),
    mailer_subjects_email_change: "Confirmez votre nouvelle adresse e-mail — Carrefour des Possibles",
    mailer_templates_email_change_content: template("email-change.html"),
    // Alerte de sécurité quand un second facteur est ajouté ou retiré.
    mailer_notifications_mfa_factor_enrolled_enabled: true,
    mailer_subjects_mfa_factor_enrolled_notification: "Un second facteur a été ajouté à votre compte — Carrefour des Possibles",
    mailer_templates_mfa_factor_enrolled_notification_content: template("mfa-enrolled.html"),
    mailer_notifications_mfa_factor_unenrolled_enabled: true,
    mailer_subjects_mfa_factor_unenrolled_notification: "Un second facteur a été retiré de votre compte — Carrefour des Possibles",
    mailer_templates_mfa_factor_unenrolled_notification_content: template("mfa-unenrolled.html"),
  };

  const smtp = smtpFromEnv();
  if (smtp) {
    Object.assign(desired, {
      smtp_host: smtp.host,
      smtp_port: smtp.port,
      smtp_user: smtp.user,
      smtp_pass: smtp.pass,
      smtp_admin_email: smtp.from,
      smtp_sender_name: "Carrefour des Possibles",
      // Avec un SMTP personnalisé, Supabase autorise davantage d'envois (les limites de la plateforme restent en place).
      rate_limit_email_sent: 30,
    });
  }

  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "carrefour-des-possibles-db/0.1" };
  const currentResponse = await fetch(url, { headers });
  if (!currentResponse.ok) throw new Error(`HTTP ${currentResponse.status} : ${await currentResponse.text()}`);
  const current = await currentResponse.json();

  // Réglage inconnu de cette version de Supabase : ignoré plutôt que de faire échouer l'ensemble.
  for (const key of Object.keys(desired)) {
    if (!(key in current)) {
      console.log(`  (réglage ${key} non proposé par ce projet : ignoré)`);
      delete desired[key];
    }
  }
  // Sans SMTP personnalisé, les modèles et notifications ne sont pas modifiables (envoi par défaut de Supabase).
  if (!smtp && !current.smtp_host) {
    for (const key of Object.keys(desired)) if (key.startsWith("mailer_subjects_") || key.startsWith("mailer_templates_") || key.startsWith("mailer_notifications_")) delete desired[key];
    console.log("Aucun SMTP personnalisé : e-mails Supabase par défaut (en anglais, 2 par heure, adresses de l’équipe du projet seulement).");
    console.log("  Pour l’ouvrir au public : EMAIL_PROVIDER=resend, EMAIL_API_KEY et EMAIL_FROM (domaine vérifié) dans .env.local, puis relancer cette commande.");
  }
  // Le mot de passe SMTP n'est jamais relu par l'API : on le renvoie seulement s'il est fourni.
  const changes = Object.keys(desired).filter((key) => SECRET_SETTINGS.has(key) || current[key] !== desired[key]);
  if (changes.length === 0) {
    console.log("Configuration d'authentification déjà à jour.");
    return;
  }
  const show = (key, value) => (SECRET_SETTINGS.has(key) ? "(secret)" : key.includes("templates") ? "(modèle d'e-mail)" : JSON.stringify(value));
  console.log(`${dryRun ? "Changements prévus (rien n'est appliqué)" : "Configuration d'authentification mise à jour"} — ${changes.length} réglage(s) :`);
  for (const key of changes) console.log(`  ${key} : ${show(key, current[key])} → ${show(key, desired[key])}`);
  if (dryRun) return;
  const response = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(desired) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} : ${smtp ? body.replaceAll(smtp.pass, "(secret)") : body}`);
  }
}

/**
 * Attribue un rôle d'équipe à un compte EXISTANT et CONFIRMÉ, en contexte système
 * (clé d'administration) : c'est ainsi que naît le premier superadministrateur. Les
 * suivants s'attribuent dans /admin/comptes. Journalisé ; aucun compte n'est créé ici.
 */
async function promote(db, email, role) {
  const roles = ["user", "professional", "local_editor", "moderator", "admin", "superadmin"];
  if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("Usage : npm run db:promote -- <adresse e-mail> [rôle]");
  if (!roles.includes(role)) throw new Error(`Rôle inconnu : ${role} (${roles.join(", ")}).`);
  const quoted = `'${email.toLowerCase().replaceAll("'", "''")}'`;
  const [account] = await db.query(
    `select u.id, u.email_confirmed_at is not null as confirmed, p.role from auth.users u join public.profiles p on p.id = u.id where lower(u.email) = ${quoted}`,
  );
  if (!account) throw new Error("Aucun compte avec cette adresse : la personne doit d'abord s'inscrire sur le site.");
  if (!account.confirmed) throw new Error("Adresse non confirmée : la personne doit d'abord confirmer son adresse e-mail.");
  if (account.role === role) {
    console.log(`Ce compte a déjà le rôle ${role}.`);
    return;
  }
  // Une seule instruction : le rôle et sa trace au journal, ensemble ou pas du tout.
  await db.query(`
    with changed as (update public.profiles set role = '${role}' where id = '${account.id}' returning id)
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    select null, 'compte.role_systeme', 'profiles', id,
           jsonb_build_object('avant', '${account.role}', 'apres', '${role}', 'raison', 'Attribution en contexte système (npm run db:promote)')
    from changed
  `);
  console.log(`Rôle ${account.role} → ${role} attribué et journalisé.`);
  if (["local_editor", "moderator", "admin", "superadmin"].includes(role)) {
    console.log("Prochaine étape : se connecter sur /admin/connexion et configurer le second facteur (application d’authentification).");
  }
}

/**
 * Sauvegardes du projet (API d'administration, lecture seule). La restauration
 * reste une action humaine délibérée, depuis le tableau de bord Supabase
 * (docs/runbook.md). Code de sortie 1 si aucune sauvegarde n'est disponible.
 */
async function listBackups() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("SUPABASE_ACCESS_TOKEN et NEXT_PUBLIC_SUPABASE_URL requis.");
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/backups`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "carrefour-des-possibles-db/0.1" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} : ${await response.text()}`);
  const info = await response.json();
  console.log(`Projet ${ref} (${info.region}) — restauration à un instant donné (PITR) : ${info.pitr_enabled ? "activée" : "non activée"}`);
  const backups = info.backups ?? [];
  for (const backup of backups.slice(0, 10)) console.log(`  ${backup.inserted_at} — ${backup.status}${backup.is_physical_backup ? " (physique)" : ""}`);
  if (backups.length === 0 && !info.pitr_enabled) {
    console.log("AUCUNE sauvegarde disponible : passer à un forfait avec sauvegardes quotidiennes (ou PITR), ou planifier un pg_dump, AVANT toute ouverture au public.");
    process.exitCode = 1;
  } else console.log(`${backups.length} sauvegarde(s) listée(s).`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "auth-config") {
  try {
    await applyAuthConfig({ dryRun: args.includes("--dry-run") });
  } catch (error) {
    console.error(`Configuration impossible : ${error.message}`);
    process.exitCode = 1;
  }
  process.exit();
}
if (command === "backups") {
  try {
    await listBackups();
  } catch (error) {
    console.error(`Lecture des sauvegardes impossible : ${error.message}`);
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
  else if (command === "promote") await promote(db, args[0], args[1] ?? "superadmin");
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
