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
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const external = process.env.SMOKE_BASE_URL;
const BASE = external ?? `http://localhost:${PORT}`;
// Jeton éphémère pour le serveur local ; sur un déploiement, fournir SMOKE_STATUS_TOKEN.
const STATUS_TOKEN = external ? process.env.SMOKE_STATUS_TOKEN : randomBytes(24).toString("hex");

const SLOGAN = "Votre ville, mille opportunités";

// Mêmes variables que le serveur (.env.local), sans écraser celles déjà définies (CI).
const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
/** Base configurée ? Sans elle (CI), les pages affichent un état « indisponible » explicite. */
const DB = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const SEARCH_DOWN = ["Recherche indisponible"];
const ACCOUNTS_DOWN = ["Comptes momentanément indisponibles"];

/** Pages validées : chemin, statut HTTP attendu, textes qui doivent apparaître. */
const PAGES = [
  { path: "/", status: 200, includes: [SLOGAN, "Carrefour des Possibles", "San Pedro"] },
  { path: "/design-system", status: 200, includes: ["Système de design", "noindex"] },
  { path: "/page-qui-n-existe-pas", status: 404, includes: ["Cette page est introuvable"] },
  { path: "/robots.txt", status: 200, includes: ["Disallow: /admin", "Sitemap:"] },
  {
    path: "/sitemap.xml",
    status: 200,
    includes: ["<loc>", "/aide", "/verification", "/decouvrir", "/tourisme", "/commerces", "/guide", "/quartiers", "/carte", "/evenements", "/emploi"],
    // Ni pages privées, ni rubriques en préparation (contenu encore mince).
    excludes: ["/design-system", "/admin", "/interne", "/publier", "/annonces", "/profil", "/hors-ligne", "/tourisme/itineraire?"],
  },
  { path: "/annonces", status: 200, includes: ["En préparation", "noindex"] },
  { path: "/immobilier", status: 200, includes: ["Immobilier à San Pedro", "Logements à louer", "Locations de courte durée"], excludes: ["En préparation"] },
  { path: "/immobilier/location", status: 200, includes: DB ? ["Logements à louer", "Filtres et tri", "à reconfirmer"] : ["Logements à louer", ...SEARCH_DOWN] },
  {
    path: "/immobilier/location?q=studio%20meubl%C3%A9%20%C3%A0%20Cit%C3%A9",
    status: 200,
    includes: DB ? ["Nous avons interprété votre recherche", "Type : studio"] : SEARCH_DOWN,
  },
  { path: "/immobilier/professionnel", status: 200, includes: ["Bureaux et locaux commerciaux"], excludes: ["Pièces (min.)"] },
  { path: "/immobilier/conseils", status: 200, includes: ["Avant une visite ou un paiement", "Guide pratique : se loger"] },
  { path: "/immobilier/comparer?annonces=a", status: 200, includes: ["Choisissez au moins deux biens", "noindex"] },
  // Paramètre dynamique inconnu : rendu « introuvable » non indexé. Statut 404, ou 200 si la réponse a déjà commencé en streaming
  // (selon le moment où la page décide) : le contenu et noindex sont exigés dans les deux cas.
  { path: "/immobilier/inconnu", status: [200, 404], includes: ["introuvable", "noindex"] },
  { path: "/nouveau-arrivant", status: 200, includes: ["Nouveau à San Pedro ?", "Commencer"] },
  { path: "/nouveau-arrivant/questions", status: 200, includes: ["Questionnaire", "noindex"] },
  {
    path: "/nouveau-arrivant/plan?motif=s_installer&duree=longue_duree&logement=location&priorites=sante",
    status: 200,
    includes: ["Comment ce plan est construit", "Santé", "noindex"],
    excludes: ["Ce plan est incomplet"],
  },
  { path: "/nouveau-arrivant/plan?motif=visiter", status: 200, includes: ["Ce plan est incomplet"] },
  { path: "/recherche", status: 200, includes: DB ? ["Aperçu", "Guide pratique", "noindex"] : [...SEARCH_DOWN, "noindex"], excludes: ["En préparation"] },
  { path: "/recherche?q=studio", status: 200, includes: DB ? ["Recherche", "Types de résultats"] : SEARCH_DOWN },
  {
    path: "/recherche?q=logement%20%C3%A0%20louer%20pr%C3%A8s%20de%20moi",
    status: 200,
    includes: DB ? ["Nous avons interprété votre recherche", "Annonces immobilières à louer", "Près de vous"] : SEARCH_DOWN,
  },
  { path: "/recherche?q=zzqqxx&type=lieux", status: 200, includes: DB ? ["Élargir la recherche"] : SEARCH_DOWN },
  { path: "/aide", status: 200, includes: ["Ma position est-elle enregistrée"] },
  { path: "/verification", status: 200, includes: ["Comment nous vérifions"] },
  { path: "/signaler", status: 200, includes: ["Signaler un contenu"] },
  { path: "/contact", status: 200, includes: ["Contact"] },
  { path: "/hors-ligne", status: 200, includes: ["Vous êtes hors ligne"] },
  { path: "/favoris", status: 307, includes: [] },
  { path: "/messages", status: 307, includes: [] },
  { path: "/messages/00000000-0000-4000-8000-000000000000", status: 307, includes: [] },
  {
    path: "/annonces/exemple-logement-location",
    status: 200,
    // Sans base, l'annonce de démonstration est introuvable (aucune donnée).
    includes: DB ? ["Contacter l’annonceur", "Description", "noindex"] : ["introuvable"],
    excludes: ["07 07", "contact_phone"],
  },
  { path: "/annonces/annonce-qui-n-existe-pas", status: 200, includes: ["introuvable", "noindex"] },
  { path: "/sw.js", status: 200, includes: ["hors-ligne"] },
  { path: "/api/health", status: 200, includes: ['"status":"ok"'], excludes: ["SUPABASE", "KEY"] },
  { path: "/connexion", status: 200, includes: DB ? ["Connexion", "Mot de passe oublié"] : ["Connexion", ...ACCOUNTS_DOWN] },
  { path: "/inscription", status: 200, includes: DB ? ["Créer un compte", "conditions d’utilisation"] : ACCOUNTS_DOWN },
  { path: "/mot-de-passe-oublie", status: 200, includes: ["Mot de passe oublié"] },
  { path: "/profil", status: 307, includes: [] },
  { path: "/profil/export", status: 307, includes: [] },
  { path: "/conditions-utilisation", status: 200, includes: ["Document provisoire"] },
  { path: "/confidentialite", status: 200, includes: ["Document provisoire", "2013-450"] },
  { path: "/mentions-legales", status: 200, includes: ["Document provisoire"] },
  { path: "/interne/statut", status: 404, excludes: ["Fonctionnalités (drapeaux)"] },
  ...(STATUS_TOKEN
    ? [{ path: `/interne/statut?token=${STATUS_TOKEN}`, status: 200, includes: ["Statut interne", "Fonctionnalités (drapeaux)", "renseignée"] }]
    : []),
];

/** Noms de variables secrètes qui ne doivent jamais apparaître dans le code envoyé au navigateur. */
const SECRET_NAMES = ["SUPABASE_SECRET_KEY", "AI_API_KEY", "PAYMENT_API_KEY", "PAYMENT_WEBHOOK_SECRET", "EMAIL_API_KEY", "INTERNAL_STATUS_TOKEN"];

function scanClientBundle() {
  const root = fileURLToPath(new URL("../.next/static", import.meta.url));
  const files = readdirSync(root, { recursive: true }).filter((file) => String(file).endsWith(".js"));
  const leaks = [];
  for (const file of files) {
    const content = readFileSync(join(root, String(file)), "utf8");
    for (const name of SECRET_NAMES) if (content.includes(name)) leaks.push(`${name} dans ${file}`);
  }
  console.log(`${leaks.length ? "✗" : "✓"} bundle navigateur (${files.length} fichiers) — ${leaks.length ? leaks.join(" ; ") : "aucun nom de secret"}`);
  return leaks.length === 0;
}

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
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", INTERNAL_STATUS_TOKEN: STATUS_TOKEN },
    });
    await waitForServer(BASE);
  }

  const failures = [];
  if (!external && !scanClientBundle()) failures.push("bundle");
  for (const page of PAGES) {
    const response = await fetch(BASE + page.path, { redirect: "manual" });
    const body = await response.text();
    const problems = [];
    const expected = [page.status].flat();
    if (!expected.includes(response.status)) problems.push(`statut ${response.status} au lieu de ${expected.join(" ou ")}`);
    for (const text of page.includes ?? []) if (!body.includes(text)) problems.push(`texte absent : « ${text} »`);
    for (const text of page.excludes ?? []) if (body.includes(text)) problems.push(`texte interdit présent : « ${text} »`);
    if (page.path === "/") {
      for (const [name, expected] of Object.entries(REQUIRED_HEADERS)) {
        const value = response.headers.get(name) ?? "";
        if (!value.includes(expected)) problems.push(`en-tête ${name} incorrect : « ${value} »`);
      }
      if (response.headers.get("x-powered-by")) problems.push("en-tête x-powered-by exposé");
    }
    const shownPath = STATUS_TOKEN ? page.path.replace(STATUS_TOKEN, "<jeton>") : page.path;
    console.log(`${problems.length ? "✗" : "✓"} ${shownPath}${problems.length ? ` — ${problems.join(" ; ")}` : ""}`);
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
