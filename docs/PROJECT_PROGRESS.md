# Journal d'avancement — Carrefour des Possibles

> À lire au début de chaque session, puis vérifier l'état réel du code.
> Dernière mise à jour : **2026-10-17** — fin de la phase 1 (fondations).

## Phases (§3.16)

| Phase | État |
| --- | --- |
| 1. Fondations | ✅ Terminée (base de données écrite, **non encore exécutée** : voir « Bloquant ») |
| 2. Pages publiques | ⏭️ Prochaine |
| 3. Fonctionnalités interactives | — |
| 4. Comptes (+ géolocalisation et carte) | — |
| 5. Services avancés | — |
| 6. Stabilisation et déploiement | — |

## Pages

| Route | Page | État |
| --- | --- | --- |
| `/` | Accueil (version fondations : marque, slogan, trois familles) | ✅ live — sections alimentées par la base à ajouter en phase 2 |
| `/design-system` | Référence du système de design (interne, non indexée) | ✅ live |
| `/robots.txt`, `/sitemap.xml` | SEO technique, générés depuis `routes.ts` | ✅ |
| 404 et erreur | Pages d'erreur avec action de reprise | ✅ |
| Toutes les autres routes de `src/config/routes.ts` | — | `planned` (affichées « Bientôt ») |

## Fonctionnalités validées

- En-tête : logo, menus Découvrir / Trouver / Entreprendre, sélecteur de ville (cookie vérifié côté serveur, repli San Pedro), recherche (désactivée tant que `/recherche` n'existe pas), Connexion et Publier (idem).
- Menu mobile en panneau latéral ; pied de page (navigation, contact et réseaux affichés seulement s'ils sont configurés, pages légales).
- Système de design : jetons, boutons, champs avec erreurs accessibles, cartes, badges de statut, alertes, états vide/erreur/chargement, modale (dialog, sheet, drawer), menu déroulant, notifications.
- Variables d'environnement validées (publiques / serveur séparées).
- En-têtes de sécurité, dont `Permissions-Policy: geolocation=(self)`.

## Composants réutilisables

`components/ui` : `Button`, `ButtonLink`, `buttonClasses`, `Input`, `Textarea`, `Select`, `Field`, `Card`, `CardBody`, `CardTitle`, `Container`, `Badge`, `StatusBadge`, `SponsoredBadge`, `SoonBadge`, `Alert`, `EmptyState`, `ErrorState`, `Spinner`, `Skeleton`, `Modal`, `Popover`, `useDismiss`, `ToastProvider`, `useToast`.
`components/layout` : `SiteHeader`, `SiteFooter`, `MainNav`, `MobileNav`, `CitySelector`, `HeaderSearch`, `NavItemLink`, `RouteButton`. `components/brand` : `Logo`, `LogoMark`.

## Données

Schéma complet (19 tables, RLS partout) : voir `docs/DATABASE.md`. Référentiel : San Pedro, 16 catégories + 26 sous-catégories, 3 offres (Pro/Premium non tarifées), paramètres. Quartiers : liste initiale **à valider**.

## Tests (dernière exécution : 2026-10-17)

| Suite | Résultat |
| --- | --- |
| `npm run typecheck` | ✅ |
| `npm run lint` | ✅ |
| `npm test` (Vitest : domaine, config, composants, SQL) | ✅ 72 tests |
| `npm run build` | ✅ |
| `npm run smoke` (serveur de production) | ✅ 5 vérifications |
| `npm run e2e` (Playwright, Edge, mobile Pixel 7 + 360 px + ordinateur 1440 px) | ✅ 17 réussis (5 ignorés par conception : scénarios propres à l'autre format d'écran) |
| `npm audit --omit=dev` | ✅ 0 vulnérabilité en production |

Vérifications visuelles faites : mobile 360 px (accueil, menu ouvert), ordinateur 1440 px (accueil, menu déroulant, modale, système de design).

## Problèmes connus et limites

- **Bloquant phase 2** : Supabase non connecté. Les migrations n'ont jamais été exécutées sur PostgreSQL réel ; à faire dès réception des clés, puis corriger toute erreur avant la phase 2.
- `npm audit` : 5 alertes « high » dans l'outillage ESLint (`braces` via `eslint-config-next`), **dépendances de développement uniquement** ; aucun correctif compatible publié. À surveiller.
- La section **4.7 (indicateurs et cibles)** citée par le cahier des charges est absente du document fourni : à transmettre.
- Quartiers de San Pedro à valider par une personne connaissant la ville.
- Le libellé « Nouveau à San Pedro ? » utilise la ville de lancement ; à rendre dépendant de la ville active quand une deuxième ville ouvrira.
- Pas de mode sombre (choix volontaire pour limiter les régressions ; à reconsidérer).

## Intégrations restant à configurer

Supabase (clés, migrations, `pg_cron`) · fournisseur de tuiles si trafic important · paiements (Orange Money, MTN MoMo, Wave via un agrégateur à choisir) · WhatsApp/e-mail/SMS · fournisseur IA · hébergement + domaine HTTPS.

## Prochaine étape

1. Connecter Supabase, exécuter migrations et seed, corriger si besoin, générer les types.
2. Phase 2 : accueil alimenté par la base (catégories, lieux, annonces récentes, événements, emploi, entreprises, appel aux annonceurs) puis pages Découvrir, Annonces, Services, Commerces, Immobilier, Événements, Emploi et pages de détail.
