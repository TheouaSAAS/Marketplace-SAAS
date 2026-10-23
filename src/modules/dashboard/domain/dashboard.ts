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

/** Une annonce publiée se confirme (et se prolonge) dans les 7 jours qui précèdent sa fin de diffusion. */
export const CONFIRM_WINDOW_DAYS = 7;
export function canConfirm(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  const remaining = new Date(expiresAt).getTime() - now.getTime();
  return remaining > 0 && remaining <= CONFIRM_WINDOW_DAYS * 24 * 3600_000;
}

/** Actions irréversibles ou qui retirent l'annonce du site : confirmation explicite demandée. */
export const SENSITIVE_ACTIONS: ListingAction[] = ["archiver", "supprimer"];

export const STATS_DEFINITIONS = [
  { label: "Vues", definition: "Visiteurs distincts ayant ouvert la fiche, une fois par jour au plus. Estimation : un même visiteur sur deux appareils compte deux fois, les robots connus sont exclus." },
  { label: "Favoris", definition: "Personnes qui ont ajouté l’annonce à leurs favoris (et ne l’ont pas retirée)." },
  { label: "Coordonnées vues", definition: "Fois où un membre connecté a affiché vos coordonnées. Cela ne dit pas s’il vous a appelé." },
  { label: "Conversations", definition: "Conversations ouvertes depuis l’annonce dans la messagerie." },
] as const;

/**
 * Catégories de notification (miroir de `public.notification_category`). Chacune
 * se règle par canal : sur le site et par e-mail. Les décisions de l'équipe
 * restent toujours affichées sur le site ; leur e-mail peut être coupé.
 */
export const NOTIFICATION_CATEGORIES = {
  decisions: { label: "Décisions de l’équipe", explain: "Publication ou refus de vos annonces et pages, suspensions, revendications, vérifications.", siteMutable: false },
  message: { label: "Messages", explain: "Nouveau message dans une conversation : une seule alerte tant qu’elle n’est pas lue.", siteMutable: true },
  demande: { label: "Demandes reçues", explain: "Demandes de contact et de devis adressées à vous ou à vos pages.", siteMutable: true },
  expiration: { label: "Annonces à confirmer", explain: "Annonce qui expire dans les 3 jours ou vient d’expirer.", siteMutable: true },
  recherche: { label: "Alertes de recherche", explain: "Nouvelles annonces pour vos recherches enregistrées avec alerte.", siteMutable: true },
  avis: { label: "Avis", explain: "Avis publiés sur vos pages professionnelles, décisions sur vos avis.", siteMutable: true },
  candidature: { label: "Candidatures", explain: "Nouvelles candidatures reçues et décisions sur les vôtres.", siteMutable: true },
  equipe: { label: "Équipe", explain: "Invitations acceptées dans vos équipes.", siteMutable: true },
  evenement: { label: "Événements", explain: "Décisions sur vos événements, reports et annulations de vos favoris.", siteMutable: true },
  rappel: { label: "Rappels", explain: "Rappel la veille d’un événement en favori.", siteMutable: true },
} as const;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;
export const NOTIFICATION_CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[];

export const ESSENTIAL_NOTIFICATIONS = "Les décisions de l’équipe restent toujours affichées sur le site.";

export interface ChannelPreferences {
  site: Record<NotificationCategory, boolean>;
  email: Record<NotificationCategory, boolean>;
  /** Plus aucun e-mail de notification. */
  emailOff: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Lecture prudente des préférences enregistrées (JSON) : canal absent ou mal formé = activé. */
export function channelPreferences(channels: unknown): ChannelPreferences {
  const stored = asRecord(channels);
  const site = {} as Record<NotificationCategory, boolean>;
  const email = {} as Record<NotificationCategory, boolean>;
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    const value = asRecord(stored[key]);
    site[key] = !NOTIFICATION_CATEGORIES[key].siteMutable || value.site !== false;
    email[key] = value.email !== false;
  }
  return { site, email, emailOff: asRecord(stored._email).off === true };
}

/** Préférences à enregistrer d'après les cases cochées (les clés inconnues sont conservées). */
export function withChannels(channels: unknown, chosen: { site: NotificationCategory[]; email: NotificationCategory[]; emailOff: boolean }): Record<string, unknown> {
  const base = { ...asRecord(channels) };
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    base[key] = { ...asRecord(base[key]), site: !NOTIFICATION_CATEGORIES[key].siteMutable || chosen.site.includes(key), email: chosen.email.includes(key) };
  }
  base._email = { ...asRecord(base._email), off: chosen.emailOff };
  return base;
}

export const PRIVACY_OPTIONS = {
  show_public_name: { label: "Afficher mon nom public", explain: "Sur mes annonces, mes commentaires et mes avis. Sinon, « Membre » est affiché." },
  show_member_since: { label: "Afficher depuis quand je suis membre", explain: "Sur mes annonces." },
  show_listing_count: { label: "Afficher le nombre de mes annonces en ligne", explain: "Sur mes annonces." },
  search_indexing: { label: "Laisser les moteurs de recherche indexer mes annonces", explain: "Sinon, mes annonces restent visibles sur le site mais demandent à Google et aux autres de ne pas les référencer." },
} as const;
export type PrivacyOption = keyof typeof PRIVACY_OPTIONS;
