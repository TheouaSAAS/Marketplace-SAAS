# Décisions techniques

Format : contexte → décision → conséquences. Ajouter une entrée pour toute décision structurante.

## D1 — Next.js 16 avec Cache Components (2026-10-17)
Besoin de pages publiques rapides et indexables, d'interactivité et d'actions serveur dans une seule base de code. Next.js 16.4 (version stable courante) avec `cacheComponents` et `partialPrefetching` activés par défaut. Conséquence : toute lecture de cookies/session se fait derrière `<Suspense>` ; les données publiques sont mises en cache par étiquette.

## D2 — Supabase (PostgreSQL + PostGIS) (2026-10-17, validé par le porteur du projet)
Relationnel, recherche géographique native, authentification, stockage et règles RLS intégrés ; offre gratuite pour le pilote. Les droits sont garantis en base, pas seulement dans l'interface.

## D3 — Leaflet + OpenStreetMap (2026-10-17, validé par le porteur du projet)
Gratuit, sans clé, bonne couverture de la Côte d'Ivoire. L'URL des tuiles est une variable d'environnement : passer à un fournisseur de tuiles payant si le trafic dépasse la politique d'usage d'OSM. Chargement uniquement sur les pages qui affichent une carte.

## D4 — Routes à statut `live` / `planned`
Le cahier des charges impose des liens toujours fonctionnels et une construction page par page. Les menus listent toute la structure du produit, mais une page non livrée est affichée « Bientôt », non cliquable. Le passage à `live` active automatiquement menus, pied de page et sitemap.

## D5 — Lieux unifiés (`places.kind`)
Établissements et lieux touristiques partagent la même table, distingués par `kind`. Une seule requête de proximité et une seule fiche de détail. Les lieux touristiques ne peuvent être créés que par l'équipe (RLS).

## D6 — Attributs d'annonce en `jsonb` validé côté serveur
Les champs propres à l'immobilier, l'emploi ou les véhicules varient. Colonnes communes (titre, prix, ville, position…) + `attributes` jsonb dont le schéma Zod dépend de `categories.attribute_schema`. Ajouter une catégorie ne demande pas de migration.

## D7 — Modération systématique, appliquée en base
Toute publication d'un utilisateur passe par « en attente » ; une modification d'une publication la renvoie en vérification. Matrices de transition dupliquées TypeScript/SQL et vérifiées identiques par test.

## D8 — Aucune donnée fictive
Le référentiel (ville, catégories, offres, paramètres) est chargé ; aucun commerce, annonce ou prix n'est inventé. Les tarifs Pro/Premium restent inactifs jusqu'à décision. La liste des quartiers est marquée « à valider ».

## D9 — Tests navigateur sur Edge installé
Playwright avec `channel: "msedge"` évite le téléchargement de navigateurs. En CI : `PW_CHANNEL=chromium`. Playwright permet aussi de simuler permissions et positions pour les tests de géolocalisation (§3.9.K).

## D10 — Validation SQL hors ligne
`libpg-query` (parseur officiel de PostgreSQL en WebAssembly) valide la syntaxe SQL et PL/pgSQL des migrations à chaque `npm test`, sans base. Ne remplace pas l'exécution réelle.

## Dépendances (justification, §3.1)
`@supabase/supabase-js`, `@supabase/ssr` (base, session) · `zod` (validation) · `lucide-react` (icônes, import à l'unité) · `clsx` + `tailwind-merge` (classes) · `server-only` (protection des secrets). Dév. : `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react` (tests), `@playwright/test` (navigateur), `libpg-query` (SQL).
