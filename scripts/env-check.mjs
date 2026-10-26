#!/usr/bin/env node
/**
 * Contrôle de la configuration d'un environnement, sans afficher aucune valeur.
 * Usage : `npm run env:check -- production` (ou preview, development).
 * Lit les variables du processus, complétées par `.env.local` s'il existe
 * (sur l'hébergeur, exporter les variables avant de lancer la commande).
 * Code de sortie 1 s'il reste une erreur bloquante.
 */
import { existsSync } from "node:fs";
import { checkDeploymentConfig } from "../src/config/deployment-checks.ts";

const target = process.argv[2] ?? "production";
if (!["development", "preview", "production"].includes(target)) {
  console.error(`Environnement inconnu : ${target} (development, preview ou production).`);
  process.exit(2);
}
const envFile = new URL("../.env.local", import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const issues = checkDeploymentConfig(process.env, target);
const errors = issues.filter((issue) => issue.level === "error");
console.log(`Contrôle de la configuration — ${target}`);
for (const issue of issues) console.log(`${issue.level === "error" ? "✗ ERREUR " : "! attention"}  ${issue.variable} : ${issue.message}`);
console.log(issues.length ? `${errors.length} erreur(s), ${issues.length - errors.length} point(s) d’attention.` : "Configuration complète.");
process.exit(errors.length ? 1 : 0);
