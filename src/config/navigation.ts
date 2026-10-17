import { LAUNCH_CITY } from "@/domain/city";
import type { RouteKey } from "./routes";

/**
 * Structure produit en trois familles (§2.3). Les familles et leurs entrées de
 * menu sont stables ; les catégories de contenu, elles, sont gérées en base
 * depuis l'administration. Les liens « par catégorie » passent un slug en
 * paramètre `categorie` : ce slug doit exister dans `supabase/seed.sql`
 * (vérifié par `navigation.test.ts`).
 */

export type FamilyKey = "decouvrir" | "trouver" | "entreprendre";

export interface NavLink {
  label: string;
  route: RouteKey;
  /** Slug de catégorie transmis en `?categorie=`. */
  category?: string;
  hash?: string;
}

export interface NavFamily {
  key: FamilyKey;
  label: string;
  tagline: string;
  route: RouteKey;
  links: NavLink[];
}

export const NEWCOMER_LINK: NavLink = {
  label: `Nouveau à ${LAUNCH_CITY.name} ?`,
  route: "newcomer",
};

export const NAV_FAMILIES: NavFamily[] = [
  {
    key: "decouvrir",
    label: "Découvrir",
    tagline: "Tourisme, sorties et bonnes adresses",
    route: "discover",
    links: [
      { label: "Guide touristique", route: "tourismGuide" },
      { label: "Lieux à visiter", route: "discover", category: "lieux-a-visiter" },
      { label: "Plages et sites naturels", route: "discover", category: "plages-sites-naturels" },
      { label: "Restaurants et gastronomie", route: "discover", category: "restaurants-gastronomie" },
      { label: "Hôtels et hébergements", route: "discover", category: "hotels-hebergements" },
      { label: "Loisirs et activités", route: "discover", category: "loisirs-activites" },
      { label: "Événements", route: "events" },
      { label: "Carte de la ville", route: "map" },
      NEWCOMER_LINK,
    ],
  },
  {
    key: "trouver",
    label: "Trouver",
    tagline: "Logement, emploi, annonces et services",
    route: "listings",
    links: [
      { label: "Immobilier", route: "realEstate" },
      { label: "Emploi et stages", route: "jobs" },
      { label: "Annonces de biens", route: "listings", category: "annonces-biens" },
      { label: "Véhicules", route: "listings", category: "vehicules" },
      { label: "Commerces et boutiques", route: "shops" },
      { label: "Services professionnels", route: "services" },
      { label: "Transport et livraison", route: "services", category: "transport-livraison" },
      { label: "Formation", route: "listings", category: "formation" },
      { label: "Opportunités commerciales", route: "jobs", category: "opportunites-commerciales" },
    ],
  },
  {
    key: "entreprendre",
    label: "Entreprendre",
    tagline: "Visibilité et outils pour les professionnels",
    route: "directory",
    links: [
      { label: "Annuaire des entreprises", route: "directory" },
      { label: "Publier une annonce", route: "publish" },
      { label: "Espace professionnel", route: "pro" },
      { label: "Offres et abonnements", route: "pricing" },
      { label: "Publicité et visibilité", route: "pricing", hash: "visibilite" },
    ],
  },
];

export const FOOTER_SECTIONS: { title: string; links: NavLink[] }[] = [
  {
    title: "Explorer",
    links: [
      { label: "Découvrir", route: "discover" },
      { label: "Annonces", route: "listings" },
      { label: "Immobilier", route: "realEstate" },
      { label: "Emploi", route: "jobs" },
      { label: "Événements", route: "events" },
      { label: "Carte", route: "map" },
    ],
  },
  {
    title: "Professionnels",
    links: [
      { label: "Annuaire des entreprises", route: "directory" },
      { label: "Publier une annonce", route: "publish" },
      { label: "Offres et abonnements", route: "pricing" },
    ],
  },
  {
    title: "Informations",
    links: [
      { label: "Contact", route: "contact" },
      { label: "Mentions légales", route: "legalNotice" },
      { label: "Conditions d’utilisation", route: "terms" },
      { label: "Politique de confidentialité", route: "privacy" },
    ],
  },
];
