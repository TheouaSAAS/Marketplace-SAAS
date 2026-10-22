# État de construction — Carrefour des Possibles

> À lire au début de chaque session, puis vérifier l'état réel du code (`git log`, `npm run check`, `npm run db:verify`).
> Dernière mise à jour : **2026-10-18** — niveau 5 terminé.

## Niveaux

| # | Niveau | État |
| --- | --- | --- |
| 0 | Architecture, stack et fondations | ✅ terminé |
| 1 | Design system et identité visuelle | ✅ terminé (voir docs/design-system.md) |
| 2 | Base de données, gouvernance et rôles | ✅ terminé (voir docs/database.md) |
| 3 | Authentification et comptes | ✅ terminé |
| 4 | Shell et navigation | ✅ terminé — 4 entrées, barre basse mobile, assistant (honnête sans IA), fil d'Ariane, 15 rubriques en préparation, aide, vérification, signalement, contact, maintenance (503), hors ligne (service worker) |
| 5 | Accueil dynamique | ✅ terminé — accroche, recherche, 8 accès rapides, 4 sections lues en base avec règles affichées, badges de vérification, avertissement de démonstration, états vides et d'erreur |
| 6 | Parcours « Nouveau à San Pedro ? » | ✅ terminé — introduction, questionnaire en 5 étapes (brouillon repris), plan déterministe expliqué bloc par bloc avec contenus réels, enregistrement facultatif dans le compte, suppression depuis le plan ou le profil |
| 7 | Moteur de recherche | ✅ terminé — recherche transversale (annonces, lieux, professionnels, événements, guide), aperçu par type puis onglets paginés, filtres facettés et tri expliqué dans l'adresse, fautes de frappe tolérées, langage courant par règles fixes, « autour de moi » sur autorisation, recherches enregistrées, statistiques anonymes |
| 8 | Détail d'annonce, favoris et contact | ✅ terminé — fiche (vérification, prix, caractéristiques, localisation selon le choix de l'annonceur avec carte, annonceur), favoris, « j'aime », partage, commentaires sans coordonnées, signalement, contact par messagerie, coordonnées seulement si partagées, annonces similaires expliquées, états expirée / en attente, données structurées ; messagerie /messages. Non livrés : galerie photo (avec la publication), compteur de vues, temps réel instantané (rafraîchissement toutes les 20 s) |
| 9 | Immobilier | ⏭️ prochain |
| 10–28 | Domaines, dashboards, admin, IA, sécurité, tests, déploiement | à faire |

## Pages et routes

| Route | Contenu | État |
| --- | --- | --- |
| `/` | Accueil dynamique (sections lues en base par ville) | live |
| `/connexion`, `/inscription` | Connexion, inscription (particulier / professionnel, consentements) | live |
| `/mot-de-passe-oublie`, `/mot-de-passe/nouveau` | Récupération d'accès | live |
| `/auth/confirmation` | Aboutissement des liens e-mail (`token_hash` ou `code`) | live |
| `/profil`, `/profil/export` | Profil, type de compte, sécurité, communications, export JSON, suppression | live (protégé) |
| `/conditions-utilisation`, `/confidentialite`, `/mentions-legales` | Pages légales **provisoires** (à valider par un juriste ; mentions « à compléter ») | live |
| `/aide`, `/verification`, `/signaler`, `/contact` | Aide (FAQ), méthode de vérification, signalement, contact | live |
| 15 rubriques : `/annonces`, `/immobilier`, `/emploi`, `/publier`, `/services`, `/commerces`, `/professionnels`, `/offres`, `/decouvrir`, `/tourisme`, `/guide`, `/quartiers`, `/carte`, `/evenements` | Écrans d'attente explicites, catégories réelles, `noindex` | preview |
| `/nouveau-arrivant` | Introduction du parcours, rappel du plan enregistré | live |
| `/nouveau-arrivant/questions`, `/nouveau-arrivant/plan` | Questionnaire et plan personnalisé (réponses dans l'adresse, `noindex`) | live (privées) |
| `/recherche` | Recherche transversale (filtres dans l'adresse, `noindex`) | live (privée) |
| `/annonces/[slug]` | Fiche d’une annonce (publique, auteur, expirée) | live |
| `/favoris` | Annonces mises en favori (protégé) | live (privée) |
| `/messages`, `/messages/[id]` | Messagerie : conversations et fil (protégé, participants uniquement) | live (privées) |
| `/maintenance`, `/hors-ligne` | Pages techniques | live (privées) |
| `/design-system` | Référence des composants (non indexée) | live |
| `/interne/statut` | Statut interne (jeton ; 404 sinon) | live |
| `/api/health` | Sonde de disponibilité | live |
| autres routes de `src/config/routes.ts` | — | planned (« Bientôt ») |

## Socle disponible

- **Configuration** : variables validées (`src/lib/env.ts`, `env.server.ts`) ; 16 drapeaux « demandé ET disponible » (`src/config/feature-flags.ts`).
- **Conventions** : `ActionResult`/`AppError`, `FormState` (`src/lib/form-state.ts`), `apiData`/`apiError`, `logger` JSON masqué, `proxy.ts` (pages internes, espaces protégés, rafraîchissement de session).
- **Design system** : 30 composants documentés (`docs/design-system.md`).
- **Comptes** (`src/modules/accounts`) : schémas Zod, actions serveur, formulaires ; `src/server/auth.ts` (identité vérifiée), `src/server/rate-limit.ts` (anti-abus en base).
- **Recherche** (`src/modules/search`) : paramètres et adresse canonique, interprétation du langage courant, périodes, position, fonctions SQL `search_*`, chargeurs de cartes par identifiants, recherches enregistrées, statistiques anonymes.
- **Parcours nouvel arrivant** (`src/modules/newcomer`) : modèle de réponses et passage par l'adresse, règles du plan (17 blocs, 8 au plus), questionnaire client, actions d'enregistrement et de suppression.
- **Données** : Supabase `towkxqwdvjdajlohevxt` (PostgreSQL 17, eu-west-1), 15 migrations, 46 tables avec RLS, tâches `pg_cron` (expiration des annonces, purges anti-abus, statistiques, vues, coordonnées consultées), types générés, démonstration étiquetée (11 éléments).

## Tests (dernière exécution : 2026-10-18)

| Suite | Résultat |
| --- | --- |
| `npm run typecheck` (strict + `noUncheckedIndexedAccess`) | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 267 tests (domaine, règles du plan nouvel arrivant, recherche : adresse, langage courant, périodes, fiche annonce : attributs, similaires, données structurées, catégories, configuration, composants, proxy, délai réseau, SQL statique, alignement des types) |
| `npm run db:verify` (base réelle, transactions annulées) | ✅ 144/144 |
| `npm run build` | ✅ |
| `npm run smoke` | ✅ 40 vérifications + scan du bundle navigateur ; adapté à l’absence de base (CI) |
| `npm run e2e` (Edge, mobile + ordinateur, 2 navigateurs à la fois, 2 comptes de test créés/supprimés automatiquement) | ✅ 119 réussis, 17 ignorés par conception ; sans base (CI) : 72 réussis, 64 ignorés |
| CI GitHub Actions | écrite, **jamais exécutée** (dépôt non poussé) |

## Problèmes connus et blocages

- **E-mails (bloquant pour l'ouverture au public)** : aucun SMTP personnalisé. Supabase n'envoie alors que 2 e-mails par heure, aux seuls membres de l'équipe du projet, en anglais. Il faut un fournisseur d'e-mails (Resend, Brevo, SMTP…) avec domaine vérifié, puis `npm run db:auth-config` appliquera les modèles français.
- `SUPABASE_ACCESS_TOKEN` (accès à tout le compte Supabase) présent dans `.env.local` pour les migrations : **à révoquer** en fin de chantier.
- Accès PostgreSQL direct bloqué depuis le poste (bannissement réseau Supabase) : migrations via l'API d'administration.
- `npm run db:verify` hors CI (pas d'identifiants en CI).
- `npm audit` : 5 alertes dans l'outillage ESLint (développement uniquement) ; 0 en production.
- Pages légales : textes provisoires, informations d'éditeur à compléter, validation juridique requise.
- Suivi d'erreurs externe non branché.
- Section 4.7 (indicateurs) du premier cahier des charges non fournie.

## Données à valider localement

Voir `docs/data-governance.md` (centre de la ville, quartiers, démonstration).

## Prochaine étape

Niveau 9 — immobilier : recherche spécialisée (location, vente, terrains, locaux), filtres précis (pièces, surface, meublé, budget), fiches adaptées, conseils de visite, sans donnée inventée.
