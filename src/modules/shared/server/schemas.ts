import { z } from "zod";

/** Fragments de schéma communs aux requêtes de contenus publics. */

export const verificationStatusSchema = z.enum(["verified", "pending_validation", "placeholder", "archived", "rejected"]);

export const categoryRefSchema = z.object({ name: z.string(), slug: z.string(), icon: z.string().nullable() });

export const neighborhoodRefSchema = z.object({ name: z.string() }).nullable();

/** Les jointures PostgREST peuvent renvoyer un objet ou un tableau selon la relation. */
export function single<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (Array.isArray(value) ? (value[0] ?? null) : value), schema);
}
