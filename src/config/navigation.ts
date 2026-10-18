import { LAUNCH_CITY } from "@/domain/city";
import type { RouteKey } from "./routes";

/**
 * Structure de navigation (cahier des charges, niveau 4) :
 *   Annonces & opportunités · Découvrir & sortir · Services & professionnels
 *   + l'accès signature « 🧭 Nouveau à San Pedro ? ».
 * Les catégories de contenu sont gérées en base ; les liens « par catégorie »
 * passent un slug en `?categorie=` qui doit exister dans `supabase/seed.sql`
 * (vérifié par `navigation.test.ts`).
 */

export type SectionKey = "annonces" | "decouvrir" | "services";

export interface NavLink {
  label: string;
  route: RouteKey;
  /** Slug de catégorie transmis en `?categorie=`. */
  category?: string;
  hash?: string;
}

export interface NavSection {
  key: SectionKey;
  label: string;
  /** Libellé court (barre mobile, petits écrans). */
  shortLabel: string;
  tagline: string;
  route: RouteKey;
  links: NavLink[];
}

export const NEWCOMER_LINK: NavLink = { label: `Nouveau à ${LAUNCH_CITY.name} ?`, route: "newcomer" };

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "annonces",
    label: "Annonces & opportunités",
    shortLabel: "Annonces",
    tagline: "Logement, emploi, biens et opportunités",
    route: "listings",
    links: [
      { label: "Toutes les annonces", route: "listings" },
      { label: "Immobilier", route: "realEstate" },
      { label: "Emploi et stages", route: "jobs" },
      { label: "Véhicules", route: "listings", category: "vehicules" },
      { label: "Biens et objets", route: "listings", category: "annonces-biens" },
      { label: "Opportunités commerciales", route: "jobs", category: "opportunites-commerciales" },
      { label: "Publier une annonce", route: "publish" },
    ],
  },
  {
    key: "decouvrir",
    label: "Découvrir & sortir",
    shortLabel: "Découvrir",
    tagline: "Tourisme, sorties et guide de la ville",
    route: "discover",
    links: [
      { label: "Tourisme", route: "tourism" },
      { label: "Restaurants", route: "discover", category: "restaurants-gastronomie" },
      { label: "Où dormir", route: "tourism", category: "hotels-hebergements" },
      { label: "Plages et sites naturels", route: "tourism", category: "plages-sites-naturels" },
      { label: "Événements", route: "events" },
      { label: "Guide pratique", route: "guide" },
      { label: "Quartiers", route: "neighborhoods" },
      { label: "Carte interactive", route: "map" },
    ],
  },
  {
    key: "services",
    label: "Services & professionnels",
    shortLabel: "Services",
    tagline: "Artisans, commerces et prestataires locaux",
    route: "services",
    links: [
      { label: "Services de proximité", route: "services" },
      { label: "Artisans et dépannage", route: "services", category: "artisans-depannage" },
      { label: "Transport et livraison", route: "services", category: "transport-livraison" },
      { label: "Commerces de proximité", route: "shops" },
      { label: "Alimentation", route: "shops", category: "alimentation" },
      { label: "Professionnels et entreprises", route: "directory" },
      { label: "Offres pour les professionnels", route: "pricing" },
    ],
  },
];

/** Barre de navigation basse (mobile) : cinq destinations, au pouce. */
export const MOBILE_TABS: { label: string; route: RouteKey; icon: "home" | "search" | "plus" | "heart" | "user" }[] = [
  { label: "Accueil", route: "home", icon: "home" },
  { label: "Rechercher", route: "search", icon: "search" },
  { label: "Publier", route: "publish", icon: "plus" },
  { label: "Favoris", route: "favorites", icon: "heart" },
  { label: "Compte", route: "profile", icon: "user" },
];

export const FOOTER_SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Explorer",
    links: [
      { label: "Annonces", route: "listings" },
      { label: "Immobilier", route: "realEstate" },
      { label: "Emploi", route: "jobs" },
      { label: "Découvrir et sortir", route: "discover" },
      { label: "Événements", route: "events" },
      { label: "Carte", route: "map" },
      NEWCOMER_LINK,
    ],
  },
  {
    title: "Professionnels",
    links: [
      { label: "Professionnels et entreprises", route: "directory" },
      { label: "Services de proximité", route: "services" },
      { label: "Commerces", route: "shops" },
      { label: "Publier une annonce", route: "publish" },
      { label: "Offres et visibilité", route: "pricing" },
    ],
  },
  {
    title: "Aide et confiance",
    links: [
      { label: "Aide", route: "help" },
      { label: "Comment nous vérifions", route: "verificationPolicy" },
      { label: "Signaler un contenu", route: "report" },
      { label: "Contact", route: "contact" },
    ],
  },
  {
    title: "Informations légales",
    links: [
      { label: "Mentions légales", route: "legalNotice" },
      { label: "Conditions d’utilisation", route: "terms" },
      { label: "Politique de confidentialité", route: "privacy" },
    ],
  },
];
