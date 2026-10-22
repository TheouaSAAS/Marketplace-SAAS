import { describe, expect, it } from "vitest";
import { ambianceLabels, budgetLabel, featureLabels } from "./attributes";
import { hoursStatus, isOpenAt, parseOpeningHours, weekLines } from "./hours";
import { parseShopFilters, shopQuery } from "./params";

const NOW = new Date("2026-10-22T10:30:00Z"); // jeudi, 10 h 30 à San Pedro (UTC)

describe("horaires", () => {
  const hours = parseOpeningHours({ jeu: [["08:00", "12:00"], ["14:00", "18:00"]], dim: [] })!;

  it("lit un format valide et refuse le reste", () => {
    expect(hours.jeu).toHaveLength(2);
    expect(parseOpeningHours({ lundi: [["08:00", "12:00"]] })).toBeNull();
    expect(parseOpeningHours({ lun: [["14:00", "09:00"]] })).toBeNull();
    expect(parseOpeningHours({})).toBeNull();
    expect(parseOpeningHours("8h-18h")).toBeNull();
  });

  it("calcule l'ouverture à l'heure de San Pedro", () => {
    expect(isOpenAt(hours, NOW)).toBe(true);
    expect(isOpenAt(hours, new Date("2026-10-22T13:00:00Z"))).toBe(false);
    expect(isOpenAt(hours, new Date("2026-10-25T10:00:00Z"))).toBe(false); // dimanche fermé
  });

  it("vérifiés seulement avec une date récente, sinon « à confirmer »", () => {
    expect(hoursStatus(hours, "2026-09-01T00:00:00Z", "Relevé terrain", NOW)).toEqual({ kind: "verified", verifiedAt: "2026-09-01T00:00:00Z", source: "Relevé terrain" });
    expect(hoursStatus(hours, null, null, NOW)).toEqual({ kind: "unconfirmed", reason: "never" });
    expect(hoursStatus(hours, "2026-01-01T00:00:00Z", "Relevé terrain", NOW)).toEqual({ kind: "unconfirmed", reason: "expired" });
    expect(hoursStatus(null, "2026-09-01T00:00:00Z", null, NOW)).toEqual({ kind: "missing" });
  });

  it("présente la semaine sans inventer : absent = non renseigné, vide = fermé", () => {
    const lines = weekLines(hours);
    expect(lines[0]).toMatchObject({ label: "Lundi", text: "Non renseigné" });
    expect(lines[3]).toMatchObject({ label: "Jeudi", text: "08:00 – 12:00, 14:00 – 18:00" });
    expect(lines[6]).toMatchObject({ label: "Dimanche", text: "Fermé" });
  });
});

describe("attributs et filtres", () => {
  it("n'affiche que les attributs connus, dans l'ordre du référentiel", () => {
    expect(featureLabels(["wifi", "inconnu", "livraison"])).toEqual(["Livraison", "Wi-Fi"]);
    expect(ambianceLabels(["calme"])).toEqual(["Calme"]);
    expect(budgetLabel(2)).toBe("Budget moyen (indicatif)");
    expect(budgetLabel(null)).toBeNull();
  });

  it("une même sélection donne une seule adresse", () => {
    const a = parseShopFilters({ services: ["wifi", "livraison", "wifi", "pirate"], ambiance: "calme,familiale", budget: "2", type: "alimentation" });
    const b = parseShopFilters({ services: "livraison,wifi", ambiance: ["familiale", "calme"], budget: "2", type: "alimentation" });
    expect(shopQuery(a)).toBe(shopQuery(b));
    expect(a.services).toEqual(["livraison", "wifi"]);
  });

  it("ignore les valeurs hors bornes", () => {
    expect(parseShopFilters({ budget: "9", rayon: "0", type: "Pas un slug", page: "-1" })).toMatchObject({ budget: null, rayon: null, type: null, page: 1 });
  });
});
