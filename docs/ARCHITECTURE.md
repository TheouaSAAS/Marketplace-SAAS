# Architecture

## Pile technique

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| Interface et serveur | Next.js 16 (App Router, React 19, TypeScript strict) | Pages publiques rendues côté serveur (SEO, mobile), composants réutilisables, actions serveur |
| Style | Tailwind CSS 4, jetons dans `src/app/globals.css` | Système de design centralisé, CSS minimal envoyé au navigateur |
| Données | Supabase : PostgreSQL + PostGIS, Auth, Storage, RLS | Base relationnelle, recherche géographique native, droits garantis en base |
| Validation | Zod | Même schéma pour les formulaires, les actions serveur et les réponses de la base |
| Carte (phase 4) | Leaflet + tuiles OpenStreetMap, chargés à la demande | Gratuit, sans clé, bonne couverture ; fournisseur de tuiles configurable |
| Tests | Vitest + Testing Library ; Playwright (Edge local) ; parseur SQL libpg_query | Unitaires, navigateur réel mobile/ordinateur, validation SQL sans base |

## Arborescence

```
src/
  app/                 Routes (une page = un dossier). layout.tsx = en-tête + pied de page communs
  components/
    ui/                Composants de base du système de design (Button, Field, Card, Badge, Modal…)
    layout/            En-tête, pied de page, navigation, sélecteur de ville, recherche
    brand/             Logo
  config/              site.ts (marque), routes.ts (carte des routes), navigation.ts (menus)
  domain/              Règles métier PURES, sans dépendance (statuts, rôles, géographie, ville)
  lib/                 Outils techniques : env (variables validées), supabase/ (clients), cn
  server/              Code serveur uniquement
    repositories/      Accès aux données (une fonction = une requête, résultat validé par Zod)
    actions/           Server Actions (mutations déclenchées par l'interface)
supabase/
  migrations/          Schéma versionné (horodaté, jamais modifié une fois appliqué en production)
  seed.sql, seeds/     Données de référence (aucun contenu fictif)
e2e/                   Tests Playwright
scripts/smoke.mjs      Test de fumée du serveur de production
tests/                 Configuration de test partagée
```

Séparation des responsabilités (§3.1) : `domain` (règles) ← `server/repositories` (données) ← `app` et `components` (interface). Les intégrations externes (paiement, IA, carte) auront chacune leur module dans `src/server/integrations/` derrière une interface, pour pouvoir changer de fournisseur.

## Flux de données et cache (Cache Components)

`cacheComponents: true` est activé. Conséquences à respecter :

- **Données publiques** (villes, catégories, contenus publiés) : lues avec le client **anonyme** `createPublicSupabaseClient()` dans des fonctions `"use cache"` + `cacheLife` + `cacheTag`. Elles font partie de la coque statique : chargement rapide sur mobile.
- **Données dépendant de la requête** (cookie de ville, session) : lues dans un composant placé **derrière `<Suspense>`**. Exemple : `CurrentCitySelector` dans `site-header.tsx`.
- **Mutations** : Server Actions dans `src/server/actions`, qui revalident les étiquettes de cache concernées (`updateTag`/`revalidateTag`).
- Trois clients Supabase : `public.ts` (anonyme, cacheable), `server.ts` (session utilisateur), `admin.ts` (clé secrète, contourne la RLS — webhooks et tâches système uniquement), plus `browser.ts`.

## Multi-ville

La ville est une entité en base (`cities`). La ville active vient du cookie `cdp_ville` (slug vérifié côté serveur) ou de la ville par défaut. Aucune ville n'est codée en dur hors du repli `LAUNCH_CITY` (utilisé seulement si la base est injoignable). Ajouter une ville = une ligne en base depuis l'administration.

## Géolocalisation (transversale, phases 3-4)

Deux notions distinctes : la **position du visiteur** (navigateur, avec permission, jamais stockée) et la **position des contenus** (`location geography(Point)` en base). Le service navigateur sera `src/lib/geolocation/` ; la recherche de proximité une fonction SQL PostGIS (`ST_DWithin`) bornée en rayon et en nombre de résultats. En-tête `Permissions-Policy: geolocation=(self)` déjà en place.
