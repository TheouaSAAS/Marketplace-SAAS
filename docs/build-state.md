# État de construction — Carrefour des Possibles

> À lire au début de chaque session, puis vérifier l'état réel du code (`git log`, `npm run check`).
> Dernière mise à jour : **2026-10-18** — niveau 2 terminé.

## Niveaux

| # | Niveau | État |
| --- | --- | --- |
| 0 | Architecture, stack et fondations | ✅ terminé |
| 1 | Design system et identité visuelle | ✅ terminé (voir docs/design-system.md) |
| 2 | Base de données, gouvernance et rôles | ✅ terminé — 9 migrations appliquées, 80/80 vérifications sur la base réelle (voir docs/database.md) |
| 3 | Authentification | ⏭️ prochain |
| 4 | Shell et navigation | partiel (en-tête, pied de page, menu mobile existants ; passage aux 4 entrées à faire) |
| 5 | Accueil dynamique | partiel (version fondations) |
| 6–28 | Domaines, dashboards, admin, IA, sécurité, tests, déploiement | à faire |

## Pages et routes

| Route | Contenu | État |
| --- | --- | --- |
| `/` | Accueil, version fondations | live |
| `/design-system` | Référence des composants (non indexée) | live |
| `/interne/statut` | Statut interne : services, drapeaux, variables (jeton ; 404 sinon) | live |
| `/api/health` | Sonde de disponibilité | live |
| `/robots.txt`, `/sitemap.xml`, 404, erreur | SEO technique et erreurs | live |
| autres routes de `src/config/routes.ts` | — | planned (« Bientôt ») |

## Socle disponible

- **Configuration** : `src/lib/env.ts` (publique) et `env.server.ts` (secrets) validées par Zod ; `src/config/feature-flags.ts` (16 drapeaux « demandé ET disponible »).
- **Conventions** : `ActionResult` et `AppError` (`src/lib/errors.ts`), `apiData`/`apiError` (`src/lib/api.ts`), `logger` JSON avec masquage (`src/lib/logger.ts`), `proxy.ts` pour les contrôles avant rendu.
- **Design system** : 30 composants (`src/components/ui`, documentés dans `docs/design-system.md`, aperçu `/design-system`), dont badges de vérification (`verified`, `pending_validation`, `placeholder`…), onglets, filtres, cases, interrupteurs, avatars, bandeau hors ligne. Contraste AA vérifié par test.
- **Domaine** : `src/domain/verification.ts` (fiabilité et expiration des vérifications), `src/lib/format.ts` (dates, prix FCFA).
- **Données** : Supabase `towkxqwdvjdajlohevxt` (PostgreSQL 17, eu-west-1). 9 migrations appliquées : 7 rôles, gouvernance (sources, vérification, historique), organisations, confidentialité des positions et contacts par droits de colonnes, domaines (guide versionné, emploi, avis, messagerie, recherches, préférences, consentements, RAG, stockage privé). Types générés (`src/types/database.ts`), clients Supabase typés. Démonstration : 11 éléments `placeholder`.

## Tests (dernière exécution : 2026-10-17)

| Suite | Résultat |
| --- | --- |
| `npm run typecheck` (strict + `noUncheckedIndexedAccess`) | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 88 tests (11 fichiers) |
| `npm run build` | ✅ |
| `npm run smoke` | ✅ 8 pages + scan du bundle navigateur (aucun nom de secret) |
| `npm run e2e` | ✅ 17 réussis, 5 ignorés par conception |
| CI GitHub Actions | écrite, **jamais exécutée** (dépôt non poussé) |

## Problèmes connus

- Accès PostgreSQL direct bloqué depuis le poste (bannissement réseau Supabase) : migrations passées par l'API d'administration (`SUPABASE_ACCESS_TOKEN`, **à révoquer** en fin de chantier base de données).
- `npm run db:verify` n'est pas dans la CI (pas d'identifiants en CI) : à lancer manuellement après chaque migration.
- `npm audit` : 5 alertes dans l'outillage ESLint (développement uniquement) ; 0 en production.
- Suivi d'erreurs externe non branché (journal JSON seulement).
- Section 4.7 (indicateurs) du premier cahier des charges non fournie.

## Données à valider localement

Voir `docs/data-governance.md` (centre de la ville, quartiers).

## Prochaine étape

Niveau 3 — authentification (inscription et connexion par e-mail, vérification, récupération, session dans `proxy.ts`, choix particulier/professionnel, consentements, export et suppression de compte).
