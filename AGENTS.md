<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Règles du projet Carrefour des Possibles

À lire avant toute tâche, par toute personne ou tout agent (Claude, Antigravity…) :

1. Lire `docs/PROJECT_PROGRESS.md` puis `docs/CONVENTIONS.md`, et inspecter l'état réel du code : ne jamais supposer qu'une description ancienne est encore exacte.
2. Une page à la fois. Ne jamais supprimer, réécrire ou dégrader une page ou un composant validé.
3. Réutiliser `src/components/ui`, `src/components/layout`, `src/config/routes.ts` ; aucun chemin en dur.
4. Aucune donnée fictive présentée comme réelle. Nom et slogan via `SITE` (`src/config/site.ts`).
5. Les droits sont garantis en base (RLS + déclencheurs, `supabase/migrations`) ; ne jamais affaiblir une règle pour faire passer un test.
6. Avant de déclarer une page terminée : `npm run check` vert, puis passer sa route à `live`, mettre à jour le journal, commit.
