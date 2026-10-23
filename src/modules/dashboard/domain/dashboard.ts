/**
 * Tableau de bord : états d'annonce expliqués et actions possibles, catégories
 * de notifications, définitions des statistiques. Les règles de transition
 * sont garanties en base ; ici, on les rend lisibles.
 */

export const LISTING_STATES = {
  draft: { label: "Brouillons", single: "Brouillon", explain: "Visible de vous seul. Terminez-le puis soumettez-le à la modération." },
  pending: { label: "En attente", single: "En attente", explain: "L’équipe relit l’annonce avant publication ; vous serez notifié." },
  published: { label: "Publiées", single: "Publiée", explain: "En ligne. Marquez-la indisponible si l’objet n’est plus disponible, ou archivez-la." },
  rejected: { label: "Refusées", single: "Refusée", explain: "Non publiée : lisez le motif, corrigez, puis soumettez de nouveau." },
  expired: { label: "Expirées", single: "Expirée", explain: "Arrivée à échéance : renouvelez-la si elle est toujours d’actualité (nouvelle relecture)." },
  archived: { label: "Archivées", single: "Archivée", explain: "Retirée du site par vous. Elle reste dans votre historique." },
} as const;
export type ListingState = keyof typeof LISTING_STATES;
export const LISTING_STATE_ORDER: ListingState[] = ["draft", "pending", "rejected", "published", "expired", "archived"];

export type ListingAction = "continuer" | "apercu" | "retirer" | "corriger" | "voir" | "disponibilite" | "archiver" | "renouveler" | "supprimer";

/** Actions proposées pour un état (la base refuse toute autre transition). */
export function listingActions(state: ListingState): ListingAction[] {
  switch (state) {
    case "draft":
      return ["continuer", "supprimer"];
    case "pending":
      return ["apercu", "retirer"];
    case "rejected":
      return ["apercu", "corriger"];
    case "published":
      return ["voir", "disponibilite", "archiver"];
    case "expired":
      return ["renouveler", "archiver"];
    case "archived":
      return [];
  }
}

/** Actions irréversibles ou qui retirent l'annonce du site : confirmation explicite demandée. */
export const SENSITIVE_ACTIONS: ListingAction[] = ["archiver", "supprimer"];

export const STATS_DEFINITIONS = [
  { label: "Vues", definition: "Visiteurs distincts ayant ouvert la fiche, une fois par jour au plus. Estimation : un même visiteur sur deux appareils compte deux fois, les robots connus sont exclus." },
  { label: "Favoris", definition: "Personnes qui ont ajouté l’annonce à leurs favoris (et ne l’ont pas retirée)." },
  { label: "Coordonnées vues", definition: "Fois où un membre connecté a affiché vos coordonnées. Cela ne dit pas s’il vous a appelé." },
  { label: "Conversations", definition: "Conversations ouvertes depuis l’annonce dans la messagerie." },
] as const;

/** Notifications que la personne peut couper ; les décisions de modération, revendications et vérifications restent envoyées. */
export const NOTIFICATION_CATEGORIES = {
  avis: { label: "Avis", explain: "Avis publiés sur vos pages professionnelles, décisions sur vos avis." },
  candidature: { label: "Candidatures", explain: "Nouvelles candidatures reçues et décisions sur les vôtres." },
  equipe: { label: "Équipe", explain: "Invitations acceptées dans vos équipes." },
  evenement: { label: "Événements", explain: "Décisions sur vos événements, reports et annulations de vos favoris." },
  rappel: { label: "Rappels", explain: "Rappel la veille d’un événement en favori." },
} as const;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

export const ESSENTIAL_NOTIFICATIONS = "Toujours envoyées : décisions de modération (annonces, pages), revendications et vérifications.";

/** Lecture prudente des préférences enregistrées (JSON) : catégorie absente ou mal formée = activée. */
export function mutedCategories(channels: unknown): NotificationCategory[] {
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) return [];
  return (Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).filter((key) => {
    const value = (channels as Record<string, unknown>)[key];
    return typeof value === "object" && value !== null && (value as Record<string, unknown>).site === false;
  });
}

/** Préférences à enregistrer d'après les cases cochées (les autres clés sont conservées). */
export function withSiteChannels(channels: unknown, enabled: NotificationCategory[]): Record<string, unknown> {
  const base = channels && typeof channels === "object" && !Array.isArray(channels) ? { ...(channels as Record<string, unknown>) } : {};
  for (const key of Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]) {
    const previous = base[key] && typeof base[key] === "object" ? (base[key] as Record<string, unknown>) : {};
    base[key] = { ...previous, site: enabled.includes(key) };
  }
  return base;
}

export const PRIVACY_OPTIONS = {
  show_public_name: { label: "Afficher mon nom public", explain: "Sur mes annonces, mes commentaires et mes avis. Sinon, « Membre » est affiché." },
  show_member_since: { label: "Afficher depuis quand je suis membre", explain: "Sur mes annonces." },
  show_listing_count: { label: "Afficher le nombre de mes annonces en ligne", explain: "Sur mes annonces." },
  search_indexing: { label: "Laisser les moteurs de recherche indexer mes annonces", explain: "Sinon, mes annonces restent visibles sur le site mais demandent à Google et aux autres de ne pas les référencer." },
} as const;
export type PrivacyOption = keyof typeof PRIVACY_OPTIONS;
