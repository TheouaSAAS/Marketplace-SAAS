/**
 * Créateur d'itinéraire : règles fixes, sans intelligence artificielle.
 *
 * - Il ne propose QUE des lieux présents en base (les candidats fournis) ; un
 *   moment sans lieu adapté est signalé « à compléter », jamais comblé.
 * - Les moments (matin, midi…) sont des repères, pas des horaires ; aucune durée
 *   de trajet ni aucun moyen de transport n'est annoncé : seulement la distance
 *   à vol d'oiseau entre deux lieux dont la position est connue.
 * - Même demande + mêmes lieux → même itinéraire (classement explicable).
 */
import { isReliable, type VerificationStatus } from "@/domain/verification";
import { isAccessibility, isAudience, isTheme, type Accessibility, type Audience, type Theme } from "./attributes";

export interface ItineraryCandidate {
  id: string;
  slug: string;
  name: string;
  category_slug: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  themes: string[];
  audiences: string[];
  visit_duration: string | null;
  price_level: number | null;
  accessibility: string[];
  warnings: string | null;
  lat: number | null;
  lng: number | null;
}

export const ITINERARY_LENGTHS = {
  demi_journee: "Une demi-journée",
  journee: "Une journée",
  deux_jours: "Deux jours",
} as const;
export type ItineraryLength = keyof typeof ITINERARY_LENGTHS;

export interface ItineraryRequest {
  duree: ItineraryLength;
  themes: Theme[];
  public: Audience | null;
  budget: number | null;
  acces: Accessibility[];
  verifie: boolean;
}

/** Moments d'une journée et catégories qui y conviennent (référentiel). */
const SLOTS = {
  visite: { label: "Découvrir", categories: ["lieux-a-visiter", "plages-sites-naturels", "excursions-guides"] },
  repas: { label: "Manger", categories: ["restaurants-gastronomie"] },
  sortie: { label: "Sortir", categories: ["loisirs-activites", "restaurants-gastronomie"] },
  nuit: { label: "Dormir", categories: ["hotels-hebergements"] },
} as const;
type SlotKind = keyof typeof SLOTS;

const PLANS: Record<ItineraryLength, { day: number; moment: string; kind: SlotKind }[]> = {
  demi_journee: [
    { day: 1, moment: "Matin", kind: "visite" },
    { day: 1, moment: "Midi", kind: "repas" },
  ],
  journee: [
    { day: 1, moment: "Matin", kind: "visite" },
    { day: 1, moment: "Midi", kind: "repas" },
    { day: 1, moment: "Après-midi", kind: "visite" },
    { day: 1, moment: "Soirée", kind: "sortie" },
  ],
  deux_jours: [
    { day: 1, moment: "Matin", kind: "visite" },
    { day: 1, moment: "Midi", kind: "repas" },
    { day: 1, moment: "Après-midi", kind: "visite" },
    { day: 1, moment: "Soirée", kind: "sortie" },
    { day: 1, moment: "Nuit", kind: "nuit" },
    { day: 2, moment: "Matin", kind: "visite" },
    { day: 2, moment: "Midi", kind: "repas" },
  ],
};

export type ItineraryStep =
  | {
      kind: "place";
      day: number;
      moment: string;
      slot: string;
      place: ItineraryCandidate;
      verified: boolean;
      reasons: string[];
      distanceKm: number | null;
    }
  | { kind: "missing"; day: number; moment: string; slot: string };

export function parseItineraryRequest(raw: Record<string, string | string[] | undefined>): ItineraryRequest | null {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const list = (value: string | string[] | undefined) => (Array.isArray(value) ? value.flatMap((item) => item.split(",")) : value ? value.split(",") : []);
  const duree = first(raw.duree);
  if (!duree || !Object.hasOwn(ITINERARY_LENGTHS, duree)) return null;
  const audience = first(raw.public);
  const budget = Number(first(raw.budget));
  return {
    duree: duree as ItineraryLength,
    themes: [...new Set(list(raw.themes).filter(isTheme))].sort(),
    public: audience && isAudience(audience) ? audience : null,
    budget: Number.isInteger(budget) && budget >= 1 && budget <= 4 ? budget : null,
    acces: [...new Set(list(raw.acces).filter(isAccessibility))].sort(),
    verifie: first(raw.verifie) === "1",
  };
}

export function itineraryQuery(request: ItineraryRequest): string {
  const query = new URLSearchParams({ duree: request.duree });
  if (request.themes.length) query.set("themes", request.themes.join(","));
  if (request.public) query.set("public", request.public);
  if (request.budget) query.set("budget", String(request.budget));
  if (request.acces.length) query.set("acces", request.acces.join(","));
  if (request.verifie) query.set("verifie", "1");
  return query.toString();
}

/** Distance à vol d'oiseau (haversine), en kilomètres. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const point = (place: ItineraryCandidate) => (place.lat !== null && place.lng !== null ? { lat: place.lat, lng: place.lng } : null);

/** Conditions impératives : public, budget, accessibilité, vérification. Une information absente ne satisfait pas une exigence. */
function eligible(place: ItineraryCandidate, request: ItineraryRequest, now: Date): boolean {
  if (request.verifie && !isReliable(place.verification_status, place.verified_at, now)) return false;
  if (request.public && !place.audiences.includes(request.public)) return false;
  if (request.budget && (place.price_level === null || place.price_level > request.budget)) return false;
  return request.acces.every((need) => place.accessibility.includes(need));
}

export function buildItinerary(candidates: readonly ItineraryCandidate[], request: ItineraryRequest, now: Date): ItineraryStep[] {
  const used = new Set<string>();
  let previous: { lat: number; lng: number } | null = null;
  return PLANS[request.duree].map(({ day, moment, kind }) => {
    const slot = SLOTS[kind];
    const options = candidates.filter(
      (place) => !used.has(place.id) && (slot.categories as readonly string[]).includes(place.category_slug) && eligible(place, request, now),
    );
    const scored = options.map((place) => {
      const verified = isReliable(place.verification_status, place.verified_at, now);
      const themeHits = place.themes.filter((theme) => (request.themes as string[]).includes(theme)).length;
      const here = point(place);
      const distance = previous && here ? distanceKm(previous, here) : null;
      // Vérifié d'abord, puis thèmes choisis, puis proximité avec l'étape précédente.
      const score = (verified ? 1000 : 0) + themeHits * 100 - (distance ?? 50);
      return { place, verified, themeHits, distance, score };
    });
    scored.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name, "fr") || a.place.id.localeCompare(b.place.id));
    const best = scored[0];
    if (!best) return { kind: "missing", day, moment, slot: slot.label };

    used.add(best.place.id);
    previous = point(best.place) ?? previous;
    const reasons = [
      best.verified ? `Informations vérifiées depuis moins d’un an` : "Informations à confirmer localement",
      best.themeHits > 0 ? `Correspond à ${best.themeHits} thème${best.themeHits > 1 ? "s" : ""} choisi${best.themeHits > 1 ? "s" : ""}` : null,
      best.distance !== null ? "Le plus proche de l’étape précédente parmi les lieux adaptés" : null,
    ].filter((reason): reason is string => reason !== null);
    return { kind: "place", day, moment, slot: slot.label, place: best.place, verified: best.verified, reasons, distanceKm: best.distance };
  });
}

