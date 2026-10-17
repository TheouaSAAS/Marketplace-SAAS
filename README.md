# Carrefour des Possibles

> « Votre ville, mille opportunités »

Plateforme numérique de découverte, d'annonces et de mise en relation locale. Lancement à **San Pedro** (Côte d'Ivoire), puis ouverture progressive dans les autres villes du pays.

## Démarrage rapide

Prérequis : **Node.js 24 LTS** et Git.

```bash
npm install
cp .env.example .env.local     # puis renseigner les valeurs (voir ci-dessous)
npm run dev                    # http://localhost:3000
```

Sans Supabase configuré, l'application démarre quand même : la navigation fonctionne et la ville par défaut (San Pedro) est utilisée. Les contenus nécessitent la base.

### Connecter Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région la plus proche : Europe de l'Ouest).
2. Dans **Project Settings → API**, copier l'URL, la clé publique (`publishable`/`anon`) et la clé secrète (`secret`/`service_role`) dans `.env.local`.
3. Appliquer le schéma, dans l'ordre (éditeur SQL du tableau de bord ou `supabase db push`) :
   1. `supabase/migrations/20261017000100_schema.sql`
   2. `supabase/migrations/20261017000200_security.sql`
   3. `supabase/seed.sql`
   4. `supabase/seeds/quartiers_san_pedro.sql` (liste à valider localement)
4. Créer le premier administrateur : s'inscrire, puis dans l'éditeur SQL :
   `update public.profiles set role = 'admin' where id = '<uuid du compte>';`

Détails : [docs/DATABASE.md](docs/DATABASE.md).

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires et de composants (Vitest) + validation SQL |
| `npm run smoke` | Test de fumée sur le serveur de production (après build) |
| `npm run e2e` | Tests navigateur mobile et ordinateur (Playwright + Edge, après build) |
| `npm run check` | Tout ce qui précède, dans l'ordre — **à lancer avant chaque commit de page** |

## Documentation

| Document | Contenu |
| --- | --- |
| [docs/PROJECT_PROGRESS.md](docs/PROJECT_PROGRESS.md) | Journal d'avancement : pages, routes, tests, problèmes connus, prochaine étape |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Structure du code et flux de données |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Règles de développement et de non-régression |
| [docs/DATABASE.md](docs/DATABASE.md) | Modèle de données, sécurité RLS, migrations |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Décisions techniques et leurs raisons |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environnements et mise en production |
