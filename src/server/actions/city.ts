"use server";

import { cookies } from "next/headers";
import { CITY_COOKIE } from "@/domain/city";
import { loadCities } from "../city-context";

export type SelectCityResult = { ok: true; slug: string } | { ok: false; message: string };

/**
 * Enregistre la ville choisie. Le slug reçu du navigateur est vérifié contre la
 * liste réelle des villes actives : une valeur inconnue est refusée.
 */
export async function selectCity(slug: string): Promise<SelectCityResult> {
  const { cities } = await loadCities();
  const city = cities.find((candidate) => candidate.slug === slug);
  if (!city) return { ok: false, message: "Cette ville n’est pas disponible." };

  (await cookies()).set(CITY_COOKIE, city.slug, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return { ok: true, slug: city.slug };
}
