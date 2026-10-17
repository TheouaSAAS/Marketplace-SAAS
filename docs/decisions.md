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

## D11 — Fusion des deux cahiers des charges (2026-10-17, arbitré par le porteur du projet)
Marque conservée (« Carrefour des Possibles », « Votre ville, mille opportunités ») ; « Tout San Pedro, au même endroit » devient l'accroche de la ville pilote. Navigation en quatre entrées : Annonces & Opportunités, Découvrir & Sortir, Services & Professionnels, 🧭 Nouveau à San Pedro ?. Construction en 28 niveaux.

## D12 — Drapeaux « demandé ET disponible »
Un drapeau seul permettrait d'afficher comme actif un service sans clé. L'état actif exige les deux. Conséquence : le site est cohérent quel que soit l'environnement, et la page de statut explique ce qui manque.

## D13 — Contrôle d'accès des pages internes dans le proxy
Avec le pré-rendu partiel, un `notFound()` exécuté dans un `<Suspense>` répond 200 (coque déjà envoyée), défaut détecté par le test de fumée. Les contrôles bloquants passent donc par `src/proxy.ts`, avec un contrôle de seconde ligne dans la page.

## D14 — Domaines métier dans `src/modules`
Les 18 domaines du plan sont regroupés par dossier avec une structure identique (domain / server / components / index). Les notions transverses restent dans `src/domain`.

## D15 — Vérification distincte de la modération
Deux axes : la **modération** (cycle de publication des contenus d'utilisateurs) et la **vérification** des données locales (`verified`, `pending_validation`, `placeholder`, `archived`, `rejected`, avec source, date et responsable). Voir `docs/data-governance.md`.

## D16 — Données de démonstration étiquetées
Autorisées par le second cahier des charges, à condition d'être `placeholder`, affichées « Exemple / à valider localement », isolées dans un seed distinct et supprimables en une opération.

## D17 — Mode hors ligne expérimental de Next.js (niveau 1)
`experimental.useOffline` détecte la perte de réseau et relance automatiquement navigations et actions bloquées : précieux sur réseau mobile instable. Risque : API expérimentale susceptible d'évoluer ; l'usage est confiné à `OfflineBanner` et peut être retiré sans impact fonctionnel.

## D18 — Émission complète des jetons (`@theme static`)
Tailwind 4 n'émet que les variables utilisées par des classes ; l'aperçu du design system et les styles en ligne affichaient des couleurs vides. Toutes les variables sont désormais émises (coût : quelques centaines d'octets).

## D19 — Migrations par l'API d'administration Supabase
Le port PostgreSQL direct est devenu inaccessible depuis le poste (bannissement automatique après des échecs d'authentification) et le mot de passe de base n'était pas disponible. `scripts/db.mjs` accepte donc deux transports : `DATABASE_URL` (préféré en CI) ou `SUPABASE_ACCESS_TOKEN` (API HTTPS). Même traçabilité que la CLI Supabase. Le jeton est sensible : à révoquer après usage.

## D20 — Tests de sécurité sur la base réelle
La validation syntaxique ne suffit pas : la première exécution réelle a révélé qu'un membre pouvait écrire dans le journal d'administration (fonction `SECURITY DEFINER` où `current_user` vaut le propriétaire). Les règles d'accès sont désormais vérifiées par scénarios SQL (`supabase/tests/*.sql`, `npm run db:verify`) exécutés dans une transaction annulée. Règle ajoutée : dans une fonction `SECURITY DEFINER`, le contexte système se teste avec `is_service_request()` (rôle du jeton), jamais avec `current_user`.

## Dépendances (justification, §3.1)
`@supabase/supabase-js`, `@supabase/ssr` (base, session) · `zod` (validation) · `lucide-react` (icônes, import à l'unité) · `clsx` + `tailwind-merge` (classes) · `server-only` (protection des secrets). Dév. : `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react` (tests), `@playwright/test` (navigateur), `libpg-query` (SQL).
