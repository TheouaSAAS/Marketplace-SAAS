# Architecture

Produit : **Carrefour des Possibles** (« Votre ville, mille opportunités »), ville pilote San Pedro, accroche locale « Tout San Pedro, au même endroit ». Portail local combinant annonces, guide de ville, tourisme, carte, professionnels, IA et back-office.

## Environnement constaté (2026-10-17)

Windows 11, Node.js 24.20 LTS, npm 11, Git 2.55, Microsoft Edge (tests navigateur). **Absents** : Docker, PostgreSQL local, Supabase CLI. Aucun service externe configuré. La plateforme doit donc fonctionner avec tous les services désactivés (vérifié : voir `/interne/statut`).

## Pile retenue

| Couche | Choix | Alternatives écartées |
| --- | --- | --- |
| Application | Next.js 16.4 (App Router, React 19, Cache Components), TypeScript strict | Remix, SvelteKit : moins d'écosystème pour le rendu serveur + actions |
| Style | Tailwind CSS 4 + jetons dans `globals.css` | Bibliothèque de composants complète : plus lourde, moins de contrôle |
| Base | Supabase (PostgreSQL 15+, PostGIS, Auth, Storage, RLS) ; pgvector pour le RAG | Firebase (non relationnel), Prisma + Postgres auto-hébergé (pas d'auth/stockage intégrés) |
| Accès aux données | `@supabase/supabase-js` + types générés (`supabase gen types`) + validation Zod | ORM (Prisma/Drizzle) : doublerait la couche de sécurité, la RLS étant l'autorité |
| Carte | Leaflet + tuiles configurables (OpenStreetMap par défaut) | Mapbox / Google : clé et facturation dès le départ (possibles plus tard via l'URL de tuiles) |
| IA | Couche serveur à fournisseur interchangeable (Anthropic ou OpenAI) | Appels depuis le navigateur : interdits (clé exposée) |
| Tests | Vitest + Testing Library, Playwright (Edge en local, Chromium en CI), libpg_query (SQL) | Jest : plus lent, configuration ESM plus lourde |

## Arborescence

```
src/
  app/                 Routes. layout.tsx = shell commun ; api/ = routes d'API ; interne/ = pages équipe
  components/ui/       Design system
  components/layout/   En-tête, pied de page, navigation
  config/              site.ts (marque), routes.ts, navigation.ts, feature-flags.ts
  domain/              Notions transverses pures (statuts, rôles, géographie, ville)
  modules/<domaine>/   Domaines métier (voir src/modules/README.md)
  lib/                 Technique : env, logger, errors, api, supabase/, internal-token
  server/              Serveur transverse : features, diagnostics, city-context, repositories, actions
  proxy.ts             Contrôles avant rendu (pages internes ; session au niveau 3)
supabase/              migrations/, seed.sql, seeds/
e2e/ scripts/ tests/   Tests navigateur, test de fumée, configuration de test
.github/workflows/     Intégration continue
```

## Conventions

**Composants** : serveur par défaut ; `"use client"` seulement pour l'interactivité. Les composants clients reçoivent des valeurs déjà évaluées (drapeaux, ville) en props, jamais de variable d'environnement serveur.

**Routes** : déclarées dans `src/config/routes.ts` (statut `live`/`planned`), construites avec `href()`. URL en français.

**Mutations** : Server Actions dans `src/server/actions` ou `src/modules/*/server`, qui retournent `ActionResult<T>` (`{ ok: true, data }` ou `{ ok: false, error: { code, message, fieldErrors } }`), valident leurs entrées avec Zod et revérifient les droits.

**API** (`src/app/api/**/route.ts`) : pour webhooks, carte, IA et intégrations. Réponse `{ data }` ou `{ error: { code, message } }` via `apiData()` / `apiError()`.

**Erreurs** : erreur attendue = `AppError(code, messageFrançais)` ; erreur inattendue = journalisée, remplacée par un message générique (`toPublicError`). Aucun détail technique vers le navigateur. Pages `error.tsx` et `not-found.tsx` à chaque niveau utile.

**Journalisation** : `logger` (`src/lib/logger.ts`), une ligne JSON par événement, niveau via `LOG_LEVEL`, masquage automatique des secrets, contacts et coordonnées. Jamais de contenu de message privé ni de position de visiteur.

**Cache** (Cache Components) : données publiques via le client anonyme dans `"use cache"` + `cacheLife` + `cacheTag` ; lectures de cookies/session derrière `<Suspense>` ; contrôle d'accès bloquant dans `proxy.ts` (un `notFound()` dans un Suspense ne change plus le code HTTP).

**Variables d'environnement** : `src/lib/env.ts` (publiques, `NEXT_PUBLIC_*`) et `src/lib/env.server.ts` (secrets, protégé par `server-only`). Le test de fumée vérifie qu'aucun nom de secret n'apparaît dans le code envoyé au navigateur.

## Routes et navigation

- Toutes les routes sont déclarées dans `src/config/routes.ts` avec un statut : `live` (terminée, indexable sauf `private`), `preview` (écran d'attente, liens actifs, `noindex`, hors sitemap), `planned` (pas de page, lien « Bientôt »). `hasPage()` décide des liens, `isLive()` de l'indexation.
- Menus : `src/config/navigation.ts` (3 rubriques + accès signature, pied de page, 5 onglets mobiles). Écrans d'attente : `src/config/sections.ts` + `SectionPreview`.
- `proxy.ts` : maintenance (503), pages internes (404 sans jeton), espaces protégés (`/profil`, `/favoris`, `/espace-pro`, `/admin`), rafraîchissement de session.
- Hors ligne : bandeau (`useOffline`) + service worker minimal (`public/sw.js`) qui ne sert que `/hors-ligne`.

## Drapeaux de fonctionnalités

`src/config/feature-flags.ts` : 16 fonctionnalités. Active = demandée (`defaultOn` ou `FEATURE_<CLÉ>=on|off`) **et** dépendances configurées. Une fonction IA forcée à `on` sans clé reste inactive. Évaluation : `src/server/features.ts`.

## Observabilité

- `/api/health` : sonde de disponibilité minimale (aucune configuration exposée).
- `/interne/statut` : état réel de la base (requête effective), des services, des drapeaux et de la présence des variables. Accès : `INTERNAL_STATUS_TOKEN` (obligatoire en production) ; 404 sinon. Administrateurs connectés à partir du niveau 3.
- Journal JSON sur la sortie standard. Suivi d'erreurs externe (Sentry ou équivalent) : variable prévue, SDK non branché.

## Conditions de fonctionnement des services externes

| Service | Nécessaire | Sans configuration |
| --- | --- | --- |
| Supabase | Projet, URL, clé publique, clé secrète ; migrations appliquées ; extensions `postgis`, `unaccent`, `pg_trgm`, `vector` | Navigation et pages statiques ; aucune donnée, comptes désactivés |
| Stockage médias | Bucket `media` (créé par migration) ; URL signées pour les fichiers privés | Pas d'envoi d'images |
| Carte | Rien pour OpenStreetMap (respect de sa politique d'usage) ; clé si Mapbox/MapTiler | — (toujours disponible) ; liste sans carte si JavaScript indisponible |
| Position GPS | HTTPS (ou localhost), permission du visiteur, action explicite. Pas de suivi en arrière-plan sur mobile | Choix manuel de la ville, du quartier ou d'une adresse |
| IA | `AI_PROVIDER`, `AI_API_KEY`, modèle, budget ; appels côté serveur uniquement | Recherche par filtres, parcours déterministes |
| Paiements | Compte marchand (agrégateur Mobile Money), clés, secret de webhook | Aucune transaction ; offres payantes non souscriptibles |
| E-mail | Fournisseur (Resend ou SMTP), domaine expéditeur vérifié | Simulation console en développement ; inactif en production |

## Multi-ville

La ville est une entité en base ; la ville active vient du cookie `cdp_ville` (vérifié côté serveur) ou de la ville par défaut. Aucun code propre à San Pedro hors du repli `LAUNCH_CITY` et des textes d'accroche.
