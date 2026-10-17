import { z } from "zod";

/**
 * Variables d'environnement PUBLIQUES (exposées au navigateur).
 *
 * Next.js n'injecte une variable NEXT_PUBLIC_* dans le bundle client que si
 * elle est référencée littéralement (`process.env.NEXT_PUBLIC_X`). C'est
 * pourquoi l'objet source en bas de fichier liste chaque variable explicitement.
 *
 * Les secrets serveur sont lus dans `env.server.ts`, jamais ici.
 */

/** Une chaîne vide dans un fichier .env équivaut à « non renseigné ». */
export function blankAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema,
  );
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: blankAsUndefined(z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_DEFAULT_CITY_SLUG: blankAsUndefined(
    z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Le slug de ville doit être en minuscules, sans accents.")
      .default("san-pedro"),
  ),
  NEXT_PUBLIC_SUPABASE_URL: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: blankAsUndefined(z.string().trim().optional()),
  NEXT_PUBLIC_CONTACT_EMAIL: blankAsUndefined(z.email().optional()),
  NEXT_PUBLIC_CONTACT_WHATSAPP: blankAsUndefined(z.string().trim().optional()),
  NEXT_PUBLIC_SOCIAL_FACEBOOK: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SOCIAL_TIKTOK: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_SOCIAL_LINKEDIN: blankAsUndefined(z.url().optional()),
  NEXT_PUBLIC_MAP_TILE_URL: blankAsUndefined(
    z.string().default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  ),
  NEXT_PUBLIC_MAP_ATTRIBUTION: blankAsUndefined(z.string().default("© contributeurs OpenStreetMap")),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function formatEnvIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${issue.path.join(".")} : ${issue.message}`).join("\n");
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variables d'environnement publiques invalides :\n${formatEnvIssues(result.error)}`);
  }
  return result.data;
}

export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_DEFAULT_CITY_SLUG: process.env.NEXT_PUBLIC_DEFAULT_CITY_SLUG,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  NEXT_PUBLIC_CONTACT_WHATSAPP: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP,
  NEXT_PUBLIC_SOCIAL_FACEBOOK: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK,
  NEXT_PUBLIC_SOCIAL_INSTAGRAM: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM,
  NEXT_PUBLIC_SOCIAL_TIKTOK: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK,
  NEXT_PUBLIC_SOCIAL_LINKEDIN: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN,
  NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
});

/** Vrai lorsque l'application peut joindre Supabase. */
export function isSupabaseConfigured(env: PublicEnv = publicEnv): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
