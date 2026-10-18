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

## D21 — Confidentialité garantie par les droits sur les colonnes
La position précise et les coordonnées de contact ne sont pas filtrées par l'interface mais rendues illisibles pour les rôles de l'API (droits PostgreSQL par colonne). Le public lit une position dérivée (`location_public`). Coût : `select("*")` interdit sur ces tables ; rappeler `grant_public_columns()` après tout ajout de colonne. Alternative écartée : vue publique séparée (double maintenance des règles RLS).

## D22 — Organisations distinctes des vitrines
`organizations` porte les membres et leurs rôles ; `business_profiles` reste la vitrine publique. Les contenus peuvent être rattachés à une organisation ; les droits passent par `can_manage_content()`, utilisé à la fois par les règles RLS et les déclencheurs.

## D23 — Quatre rôles d'équipe séparés
Modération (contenus des membres), éditeurs locaux (données de la ville), administrateurs (comptes, référentiel) et superadministrateurs (rôles d'administration). Un modérateur ne vérifie pas les données locales ; un administrateur ne crée pas d'administrateur.

## D24 — Données de démonstration visibles derrière un paramètre
Le paramètre `demo.public_placeholders` (activé pendant le pilote) contrôle en base la visibilité des exemples. Le désactiver fait disparaître tous les exemples du public sans les supprimer ; `demo_remove.sql` les supprime.

## D25 — Authentification Supabase, session vérifiée
Inscription et connexion par e-mail et mot de passe (Supabase Auth). L'identité est toujours établie par `getClaims()` (signature vérifiée), jamais par la session lue dans le cookie. Le proxy rafraîchit la session seulement si un cookie de session existe. Lecture de session précédée de `connection()` : la vérification du jeton lit l'heure, interdit dans un pré-rendu (défaut trouvé par les tests navigateur). Déconnexion locale à l'appareil (`scope: "local"`). Téléphone, OTP et OAuth : non activés (aucun fournisseur configuré), l'architecture (`verifyOtp`, route de confirmation) les accepte.

## D26 — Anti-énumération et anti-abus
Inscription et mot de passe oublié répondent toujours la même chose ; la connexion ne distingue pas e-mail et mot de passe faux. Limitation de débit par IP et par adresse visée, en base (`consume_rate_limit`, appelable uniquement par le serveur), avec empreintes HMAC purgées toutes les heures (`pg_cron`). `RATE_LIMIT_SCALE` relève les limites pour les tests automatisés seulement.

## D27 — Configuration d'authentification versionnée
`npm run db:auth-config` applique depuis le dépôt la politique de mot de passe (10 caractères, lettres et chiffres), la ré-authentification pour changer de mot de passe et les adresses de redirection. Les modèles d'e-mails français (`supabase/templates/`) ne sont applicables qu'avec un SMTP personnalisé (refus de Supabase sur l'offre gratuite) ; la route `/auth/confirmation` accepte les deux formats de lien (`token_hash` et `code`).

## D28 — Suppression de compte avec conservation pseudonymisée
La suppression efface le compte et ses contenus personnels, mais conserve détachés du compte : fiches de lieux (donnée locale), paiements, abonnements et campagnes (obligations comptables). Défaut trouvé en réel : un utilisateur ayant payé ne pouvait pas supprimer son compte (correctif `…000900`).

## D29 — Troisième statut de route : `preview`
Le niveau 4 exige que toutes les rubriques majeures soient accessibles avant que leurs contenus existent. Une route `preview` a une vraie page (écran d'attente explicite, catégories réelles lues en base, liens utiles), des liens actifs, mais reste hors sitemap et en `noindex` (contenu mince). `hasPage()` gouverne les liens, `isLive()` l'indexation. Remplace l'ancien principe « Bientôt, non cliquable », conservé seulement pour les routes `planned` (détails, espace pro, administration).

## D30 — Navigation : quatre entrées, deux lignes, barre basse
Ordinateur : en-tête (recherche, ville, favoris, compte, Publier) + barre des trois rubriques et de l'accès signature « Nouveau à San Pedro ? ». Mobile : en-tête minimal (logo, ville, menu) et barre basse à cinq onglets (Accueil, Rechercher, Publier, Favoris, Compte) dans la zone du pouce, avec marge basse du corps pour ne jamais masquer le contenu (vérifié par test).

## D31 — Service worker limité à la page « Hors ligne »
Un service worker qui met en cache des pages risquerait d'afficher une annonce retirée ou un prix modifié. Le nôtre ne met en cache que `/hors-ligne`, servie uniquement quand une navigation échoue faute de réseau ; tout le reste passe par le réseau. Enregistré en production seulement.

## D32 — Maintenance par le proxy, en 503
`FEATURE_MAINTENANCE=on` remplace toutes les pages publiques par `/maintenance` avec le code 503 et `Retry-After` (les moteurs de recherche ne désindexent pas le site), sauf la supervision (`/api/health`, `/interne`).

## D33 — Assistant visible mais honnête
Le lanceur « Demandez à San Pedro » est présent sur toutes les pages, sans gêner la navigation (au-dessus de la barre basse). Sans IA configurée, il le dit et oriente vers les parcours existants ; il ne simule aucune réponse.

## D34 — Délai maximal et journalisation des appels Supabase
Les tests ont révélé qu'une perturbation réseau pouvait figer un formulaire indéfiniment, puis, une fois un délai ajouté, afficher « mot de passe incorrect » ou « e-mail envoyé » à tort. Tous les clients Supabase côté serveur utilisent `fetchWithTimeout` (10 s), qui journalise les appels lents (≥ 3 s) et interrompus (chemin, durée, sans données personnelles). Les actions de compte distinguent la panne réseau (`isAuthRetryableFetchError`) d'un refus réel et affichent « momentanément indisponible ». Les tests navigateur autorisent une nouvelle tentative, signalée « flaky » dans le rapport.

## Dépendances (justification, §3.1)
`@supabase/supabase-js`, `@supabase/ssr` (base, session) · `zod` (validation) · `lucide-react` (icônes, import à l'unité) · `clsx` + `tailwind-merge` (classes) · `server-only` (protection des secrets). Dév. : `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react` (tests), `@playwright/test` (navigateur), `libpg-query` (SQL), `pg` (outil de migration par connexion directe).
