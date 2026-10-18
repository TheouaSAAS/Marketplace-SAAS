import type { SearchSort, SearchType } from "./params";

/** Règles de classement, affichées telles quelles sous les résultats (« Pourquoi cet ordre ? »). */
export const SORT_RULES: Record<SearchSort, string> = {
  pertinence:
    "Correspondance avec votre texte (le titre compte plus que la description, les fautes de frappe légères sont tolérées), puis informations vérifiées et à jour, puis les plus récentes.",
  recent: "Les plus récemment publiées ou mises à jour d’abord.",
  prix_asc: "Prix déclaré par l’annonceur, du moins cher au plus cher ; les annonces sans prix viennent en dernier.",
  prix_desc: "Prix déclaré par l’annonceur, du plus cher au moins cher ; les annonces sans prix viennent en dernier.",
  date: "Les événements les plus proches dans le temps d’abord ; un événement terminé n’apparaît jamais, une annulation est signalée.",
  proximite:
    "Du plus proche au plus éloigné de votre position. Pour une annonce, la distance est calculée sur la position publique, volontairement approximative.",
};

export const NO_SPONSORING = "Aucun résultat n’est sponsorisé : l’ordre ne dépend d’aucun paiement.";

/** Règle de l'aperçu : trois résultats par type, chacun selon son tri par défaut. */
export function overviewRule(hasQuery: boolean): string {
  return hasQuery
    ? "Pour chaque type, les trois résultats les plus pertinents. Les types restent séparés : une annonce n’est jamais mélangée à un article du guide."
    : "Pour chaque type, les trois contenus les plus récents (événements : les plus proches dans le temps). Les types restent séparés.";
}

export const TYPE_DESCRIPTIONS: Record<SearchType, string> = {
  annonces: "Biens, logements, emplois, services et opportunités publiés par des particuliers ou des professionnels.",
  lieux: "Commerces, restaurants, hébergements et lieux à visiter recensés.",
  professionnels: "Fiches des entreprises, artisans et indépendants.",
  evenements: "Événements à venir ou en cours.",
  guide: "Articles pratiques pour s’installer et vivre en ville.",
};
