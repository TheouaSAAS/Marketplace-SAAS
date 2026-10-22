import type { RouteKey } from "./routes";

/**
 * Contenu des écrans d'attente des rubriques (statut `preview`). Chaque
 * rubrique annonce ce qu'elle proposera et à quel niveau du plan elle sera
 * livrée, sans aucune donnée fictive. Les catégories affichées viennent de la
 * base (référentiel réel, géré depuis l'administration).
 */
export interface SectionPreviewConfig {
  title: string;
  intro: string;
  /** Ce que la rubrique proposera. */
  upcoming: readonly string[];
  /** Rubrique parente pour le fil d'Ariane. */
  parent?: RouteKey;
  /** Catégories (slugs racines) à présenter, lues en base. */
  categories?: readonly string[];
  /** Rubriques voisines déjà accessibles. */
  related: readonly RouteKey[];
}

export const SECTION_PREVIEWS = {
  listings: {
    title: "Annonces et opportunités",
    intro: "Toutes les annonces de San Pedro au même endroit : logement, emploi, biens, véhicules, services et opportunités.",
    upcoming: [
      "Recherche par mots-clés, catégorie, quartier, prix et distance",
      "Fiches d’annonce avec galerie, statut de vérification et contact protégé",
      "Favoris et alertes sur vos recherches",
    ],
    categories: ["immobilier", "emploi-stages", "annonces-biens", "vehicules", "opportunites-commerciales", "formation"],
    related: ["realEstate", "jobs", "publish", "newcomer"],
  },
  jobs: {
    title: "Emploi et opportunités",
    intro: "Offres d’emploi, stages, missions, formations et appels à prestataires à San Pedro.",
    upcoming: [
      "Filtres : contrat, domaine, expérience, date limite",
      "Candidature interne avec données privées par défaut",
      "Offres closes ou expirées signalées et fermées aux candidatures",
    ],
    parent: "listings",
    categories: ["emploi-stages", "opportunites-commerciales", "formation", "appels-offres"],
    related: ["listings", "directory"],
  },
  publish: {
    title: "Publier une annonce",
    intro: "Publiez gratuitement une annonce, vérifiée par l’équipe de modération avant sa mise en ligne.",
    upcoming: [
      "Formulaire guidé selon la catégorie, brouillon enregistré automatiquement",
      "Aide facultative à la rédaction, toujours modifiable avant publication",
      "Suivi du statut : brouillon, en attente, publiée",
    ],
    parent: "listings",
    related: ["signup", "listings", "help"],
  },
  directory: {
    title: "Professionnels et entreprises",
    intro: "L’annuaire des professionnels de San Pedro : commerces, artisans, agences, opérateurs.",
    upcoming: [
      "Pages professionnelles : présentation, services, zone, contacts, annonces",
      "Badges clairs : profil complété, vérifié, sponsorisé — jamais confondus",
      "Avis modérés et réponses des professionnels",
    ],
    parent: "services",
    related: ["services", "shops", "pricing", "signup"],
  },
  pricing: {
    title: "Offres pour les professionnels",
    intro: "La publication et la vitrine de base sont gratuites. Des options de visibilité seront proposées aux professionnels.",
    upcoming: [
      "Offres transparentes, prix affichés avant toute souscription",
      "Mises en avant toujours signalées « Sponsorisé »",
      "Paiement Mobile Money ou carte, uniquement après confirmation réelle",
    ],
    parent: "directory",
    related: ["directory", "publish", "contact"],
  },
} as const satisfies Partial<Record<RouteKey, SectionPreviewConfig>>;

export type PreviewSectionKey = keyof typeof SECTION_PREVIEWS;
