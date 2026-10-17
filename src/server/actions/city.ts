"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { CITY_COOKIE } from "@/domain/city";
import { fail, ok, type ActionResult } from "@/lib/errors";
import { loadCities } from "../city-context";

const slugSchema = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Enregistre la ville choisie. Le slug reçu du navigateur est vérifié contre la
 * liste réelle des villes actives : une valeur inconnue est refusée.
 */
export async function selectCity(slug: string): Promise<ActionResult<{ slug: string }>> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return fail("validation", "Ville invalide.");

  const { cities } = await loadCities();
  const city = cities.find((candidate) => candidate.slug === parsed.data);
  if (!city) return fail("not_found", "Cette ville n’est pas disponible.");

  (await cookies()).set(CITY_COOKIE, city.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return ok({ slug: city.slug });
}
