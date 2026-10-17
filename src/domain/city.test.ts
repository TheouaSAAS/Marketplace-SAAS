import { describe, expect, it } from "vitest";
import { resolveCity, type CitySummary } from "./city";

const fallback: CitySummary = { id: null, slug: "san-pedro", name: "San Pedro" };
const cities: CitySummary[] = [
  { id: "1", slug: "san-pedro", name: "San Pedro" },
  { id: "2", slug: "abidjan", name: "Abidjan" },
];

describe("resolveCity", () => {
  it("retient la ville choisie si elle existe", () => {
    expect(resolveCity(cities, "abidjan", fallback).slug).toBe("abidjan");
  });

  it("revient à la ville par défaut si le cookie désigne une ville inconnue", () => {
    expect(resolveCity(cities, "ville-fermee", fallback).slug).toBe("san-pedro");
  });

  it("utilise le repli si aucune ville n'est disponible", () => {
    expect(resolveCity([], undefined, fallback)).toBe(fallback);
  });
});
