#!/usr/bin/env node
/**
 * Test de fumée de non-régression sur le serveur de PRODUCTION.
 * Prérequis : `npm run build`. Usage : `npm run smoke`.
 *
 * Démarre `next start` sur un port dédié (ou utilise SMOKE_BASE_URL si fourni),
 * puis vérifie que chaque page validée répond correctement. À compléter à
 * chaque nouvelle page livrée (tableau PAGES ci-dessous).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const external = process.env.SMOKE_BASE_URL;
const BASE = external ?? `http://localhost:${PORT}`;

const SLOGAN = "Votre ville, mille opportunités";

/** Pages validées : chemin, statut HTTP attendu, textes qui doivent apparaître. */
const PAGES = [
  { path: "/", status: 200, includes: [SLOGAN, "Carrefour des Possibles", "Découvrir", "Trouver", "Entreprendre", "San Pedro"] },
  { path: "/design-system", status: 200, includes: ["Système de design", "noindex"] },
  { path: "/page-qui-n-existe-pas", status: 404, includes: ["Cette page est introuvable"] },
  { path: "/robots.txt", status: 200, includes: ["Disallow: /admin", "Sitemap:"] },
  { path: "/sitemap.xml", status: 200, includes: ["<loc>"], excludes: ["/design-system", "/admin"] },
];

const REQUIRED_HEADERS = {
  "x-content-type-options": "nosniff",
  "permissions-policy": "geolocation=(self)",
  "x-frame-options": "DENY",
};

let server;

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Le serveur n'a pas démarré sur ${url} en ${timeoutMs / 1000} s.`);
}

async function main() {
  if (!external) {
    const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
    server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
      stdio: ["ignore", "ignore", "inherit"],
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    await waitForServer(BASE);
  }

  const failures = [];
  for (const page of PAGES) {
    const response = await fetch(BASE + page.path, { redirect: "manual" });
    const body = await response.text();
    const problems = [];
    if (response.status !== page.status) problems.push(`statut ${response.status} au lieu de ${page.status}`);
    for (const text of page.includes ?? []) if (!body.includes(text)) problems.push(`texte absent : « ${text} »`);
    for (const text of page.excludes ?? []) if (body.includes(text)) problems.push(`texte interdit présent : « ${text} »`);
    if (page.path === "/") {
      for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
        const value = response.headers.get(name) ?? "";
        if (!value.includes(expected)) problems.push(`en-tête ${name} incorrect : « ${value} »`);
      }
      if (response.headers.get("x-powered-by")) problems.push("en-tête x-powered-by exposé");
    }
    console.log(`${problems.length ? "✗" : "✓"} ${page.path}${problems.length ? ` — ${problems.join(" ; ")}` : ""}`);
    if (problems.length) failures.push(page.path);
  }

  if (failures.length) {
    console.error(`\n${failures.length} page(s) en échec.`);
    process.exitCode = 1;
  } else {
    console.log(`\nToutes les pages validées répondent correctement (${PAGES.length}).`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server?.kill());
