import { describe, expect, it } from "vitest";
import { durationRank, labels, THEMES } from "./attributes";
import { buildItinerary, distanceKm, itineraryQuery, parseItineraryRequest, type ItineraryCandidate } from "./itinerary";
import { parseTourismFilters, tourismQuery } from "./params";

const NOW = new Date("2026-10-22T10:00:00Z");

function place(id: string, category: string, extra: Partial<ItineraryCandidate> = {}): ItineraryCandidate {
  return {
    id,
    slug: id,
    name: id,
    category_slug: category,
    verification_status: "pending_validation",
    verified_at: null,
    themes: [],
    audiences: [],
    visit_duration: null,
    price_level: null,
    accessibility: [],
    warnings: null,
    lat: null,
    lng: null,
    ...extra,
  };
}

const request = parseItineraryRequest({ duree: "journee", themes: "nature" })!;

describe("créateur d'itinéraire", () => {
  it("ne propose que des lieux fournis et signale un moment sans lieu, sans le combler", () => {
    const steps = buildItinerary([place("plage", "plages-sites-naturels"), place("maquis", "restaurants-gastronomie")], request, NOW);
    expect(steps.map((step) => (step.kind === "place" ? step.place.id : `manque:${step.moment}`))).toEqual([
      "plage",
      "maquis",
      "manque:Après-midi",
      "manque:Soirée",
    ]);
  });

  it("ne réutilise jamais un lieu et préfère vérifié, puis thèmes choisis, puis proximité", () => {
    const steps = buildItinerary(
      [
        place("musee", "lieux-a-visiter", { lat: 4.75, lng: -6.63 }),
        place("foret", "plages-sites-naturels", { themes: ["nature"], lat: 4.9, lng: -6.63 }),
        place("verifie", "lieux-a-visiter", { verification_status: "verified", verified_at: "2026-09-01T00:00:00Z", lat: 4.751, lng: -6.63 }),
        place("table", "restaurants-gastronomie", { lat: 4.752, lng: -6.63 }),
      ],
      request,
      NOW,
    );
    const ids = steps.flatMap((step) => (step.kind === "place" ? [step.place.id] : []));
    expect(ids.slice(0, 3)).toEqual(["verifie", "table", "foret"]);
    expect(new Set(ids).size).toBe(ids.length);
    const second = steps[1];
    expect(second?.kind === "place" && second.distanceKm).toBeCloseTo(0.11, 1);
  });

  it("public, budget et accessibilité sont impératifs ; une information absente ne les satisfait pas", () => {
    const strict = parseItineraryRequest({ duree: "demi_journee", public: "enfants", budget: "2", acces: "fauteuil_roulant" })!;
    const steps = buildItinerary(
      [
        place("ok", "lieux-a-visiter", { audiences: ["enfants"], price_level: 1, accessibility: ["fauteuil_roulant"] }),
        place("inconnu", "lieux-a-visiter", { audiences: ["enfants"], accessibility: ["fauteuil_roulant"] }),
        place("cher", "restaurants-gastronomie", { audiences: ["enfants"], price_level: 4, accessibility: ["fauteuil_roulant"] }),
      ],
      strict,
      NOW,
    );
    expect(steps[0]).toMatchObject({ kind: "place", place: { id: "ok" } });
    expect(steps[1]).toMatchObject({ kind: "missing", moment: "Midi" });
  });

  it("même demande, même itinéraire ; deux jours incluent une nuit", () => {
    const pool = [place("a", "lieux-a-visiter"), place("b", "lieux-a-visiter"), place("h", "hotels-hebergements")];
    const twoDays = parseItineraryRequest({ duree: "deux_jours" })!;
    expect(buildItinerary(pool, twoDays, NOW)).toEqual(buildItinerary([...pool].reverse(), twoDays, NOW));
    expect(buildItinerary(pool, twoDays, NOW).find((step) => step.moment === "Nuit")).toMatchObject({ kind: "place", place: { id: "h" } });
  });

  it("lit et réécrit la demande sans valeur inventée", () => {
    expect(parseItineraryRequest({ duree: "semaine" })).toBeNull();
    const parsed = parseItineraryRequest({ duree: "journee", themes: ["plage,nature", "inconnu"], public: "martiens", budget: "9" })!;
    expect(parsed).toMatchObject({ themes: ["nature", "plage"], public: null, budget: null });
    expect(itineraryQuery(parsed)).toBe("duree=journee&themes=nature%2Cplage");
  });

  it("distance à vol d'oiseau", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0);
  });
});

describe("exploration touristique", () => {
  it("une même sélection donne une seule adresse", () => {
    const a = parseTourismFilters({ themes: ["plage", "nature", "plage"], acces: "poussette", duree: "une_2h", budget: "2" });
    const b = parseTourismFilters({ themes: "nature,plage", acces: ["poussette", "inconnu"], duree: "une_2h", budget: "2" });
    expect(tourismQuery(a)).toBe(tourismQuery(b));
    expect(parseTourismFilters({ duree: "semaine", rayon: "500" })).toMatchObject({ duree: null, rayon: null });
  });

  it("libellés et rang de durée", () => {
    expect(labels(THEMES, ["plage", "inconnu", "nature"])).toEqual(["Nature", "Plage"]);
    expect(durationRank("demi_journee")).toBe(3);
    expect(durationRank(null)).toBeNull();
  });
});
