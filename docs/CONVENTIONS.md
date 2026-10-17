# Conventions et méthode de travail

## Méthode pour chaque nouvelle page (§6.5)

1. Lire `docs/PROJECT_PROGRESS.md` et inspecter le code réel.
2. Définir le périmètre ; lister fichiers à créer / à modifier et risques de régression.
3. Réutiliser `components/ui`, `components/layout`, `href()` ; ne créer un composant que s'il manque.
4. Développer uniquement le nécessaire.
5. Tests : unitaires (`*.test.ts(x)` à côté du code), scénario Playwright dans `e2e/`, ajout de la page dans `scripts/smoke.mjs`.
6. `npm run check` doit être entièrement vert (typage, lint, tests, build, fumée, navigateur).
7. Passer la route à `status: "live"` dans `src/config/routes.ts` : menus, pied de page et sitemap s'activent seuls.
8. Mettre à jour `docs/PROJECT_PROGRESS.md`, puis commit.

Une régression se corrige avant de passer à la page suivante.

## Code

- **Langue** : interface, messages d'erreur, commentaires et documentation en français. Identifiants de code en anglais ; segments d'URL en français (`/annonces`, `/evenements`).
- **Fichiers** : `kebab-case.tsx` ; composants en `PascalCase` ; un composant partagé par fichier ou petit groupe cohérent.
- **Chemins** : jamais de chaîne `"/annonces"` en dur, toujours `href("listings")`.
- **Marque** : `SITE.name` et `SITE.slogan`, jamais retapés.
- **Couleurs** : jetons uniquement (`bg-brand-600`, `text-ink-muted`…), jamais de valeur hexadécimale dans un composant.
- **Serveur** : tout module qui lit un secret ou la base commence par `import "server-only"`.
- **Données entrantes** (formulaires, base, API) : validées par Zod à la frontière.
- **Accessibilité** : cible tactile ≥ 44 px, libellé associé à chaque champ, `aria-*` sur les composants interactifs, contraste AA, `prefers-reduced-motion` respecté.
- **Mobile d'abord** : styles de base pour 360 px, puis `sm:` (640), `md:` (768), `lg:` (1024), `xl:` (1280).
- **Pas de données fictives** présentées comme réelles. Un exemple visuel (page `/design-system`) reste interne et non indexé.

## Modifications globales

Toute modification de `globals.css`, `layout.tsx`, `components/ui` ou `components/layout` touche toutes les pages : vérifier `/design-system` et lancer `npm run e2e` (mobile + ordinateur) avant commit.

## Base de données

- Une modification de schéma = une **nouvelle** migration horodatée dans `supabase/migrations/` (jamais modifier une migration déjà appliquée en production).
- Toute nouvelle table : `enable row level security` + au moins une policy (vérifié par `supabase/migrations.test.ts`).
- Toute fonction : `set search_path = ''` (vérifié par test).
- Les matrices de transition de statut existent en TypeScript et en SQL : un test vérifie qu'elles sont identiques.

## Git

- Branche principale `main` ; une branche par page ou fonctionnalité si plusieurs personnes travaillent.
- Messages au format `type: description en français` — `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- Un commit (point de contrôle) par page validée. Jamais de `.env.local` ni de clé dans le dépôt.
