import { existsSync } from "node:fs";

// Mêmes variables que le serveur (.env.local), sans écraser celles déjà définies (CI).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

/**
 * Base de données configurée ? En CI (aucun secret), les pages qui en
 * dépendent affichent un état « indisponible » explicite : les tests qui
 * exigent des contenus réels sont alors ignorés, et l'état dégradé est testé.
 */
export const HAS_DATABASE = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const NO_DATABASE = "Supabase non configuré";
