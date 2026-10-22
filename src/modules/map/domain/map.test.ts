import { describe, expect, it } from "vitest";
import { clusterPoints } from "./cluster";
import { directionsHref } from "./layers";
import { mapQuery, parseMapFilters, parseZone } from "./params";

describe("critères de la carte", () => {
  it("toutes les couches par défaut ; une même sélection donne une seule adresse", () => {
    expect(mapQuery(parseMapFilters({}))).toBe("");
    const a = parseMapFilters({ couches: "tourisme,immobilier,inconnue,tourisme", quartier: "cite" });
    expect(a.couches).toEqual(["immobilier", "tourisme"]);
    expect(mapQuery(a)).toBe("couches=immobilier%2Ctourisme&quartier=cite");
    expect(parseMapFilters({ couches: "" }).couches).toEqual([]);
    // Cases cochées : paramètres répétés, regroupés dans la forme canonique.
    expect(mapQuery(parseMapFilters({ couches: ["tourisme", "commerces"] }))).toBe("couches=commerces%2Ctourisme");
  });

  it("zone arrondie, ordonnée et à l'échelle d'une ville", () => {
    expect(parseZone("-6.700012,4.7,-6.6,4.8")).toEqual({ west: -6.7, south: 4.7, east: -6.6, north: 4.8 });
    expect(parseZone("-6.6,4.7,-6.7,4.8")).toBeNull();
    expect(parseZone("-10,0,0,10")).toBeNull();
    expect(parseZone("a,b,c,d")).toBeNull();
  });
});

describe("regroupement des marqueurs", () => {
  const points = [
    { id: "a", lat: 4.75, lng: -6.63 },
    { id: "b", lat: 4.7501, lng: -6.6301 },
    { id: "c", lat: 4.8, lng: -6.5 },
  ];
  it("regroupe les points proches à faible zoom et les sépare en zoomant", () => {
    const far = clusterPoints(points, 12);
    expect(far.map((cluster) => cluster.ids)).toContainEqual(["a", "b"]);
    expect(far).toHaveLength(2);
    expect(clusterPoints(points, 19)).toHaveLength(3);
  });
  it("est déterministe", () => {
    expect(clusterPoints([...points].reverse(), 12)).toEqual(clusterPoints(points, 12));
  });
});

describe("itinéraire", () => {
  it("seulement vers un point exact, confié à une application cartographique", () => {
    expect(directionsHref({ lat: 4.75, lng: -6.63, location_precision: "exact" })).toBe("https://www.openstreetmap.org/directions?to=4.75%2C-6.63");
    expect(directionsHref({ lat: 4.75, lng: -6.63, location_precision: "approximate" })).toBeNull();
  });
});
