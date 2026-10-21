/** Règles de présentation d'une annonce : localisation, état, coordonnées. */

export type PublicLocationPrecision = "exact" | "approximate" | "neighborhood" | "hidden";

/** Ce que la carte montre, selon le choix de l'annonceur. */
export const LOCATION_DISPLAY: Record<PublicLocationPrecision, { label: string; description: string; radiusMeters: number | null }> = {
  exact: {
    label: "Emplacement précis",
    description: "L’annonceur a choisi d’indiquer l’emplacement exact.",
    radiusMeters: null,
  },
  approximate: {
    label: "Zone approximative",
    description: "Pour protéger l’annonceur, seule une zone d’environ 500 m est indiquée. L’adresse se précise en échangeant avec lui.",
    radiusMeters: 400,
  },
  neighborhood: {
    label: "Quartier seulement",
    description: "L’annonceur indique seulement le quartier. L’adresse se précise en échangeant avec lui.",
    radiusMeters: null,
  },
  hidden: {
    label: "Emplacement non communiqué",
    description: "L’annonceur ne communique pas d’emplacement. Demandez-le-lui par la messagerie.",
    radiusMeters: null,
  },
};

export type ListingState = "active" | "unavailable" | "expired" | "archived" | "pending" | "draft" | "rejected";

export const STATE_NOTICES: Record<Exclude<ListingState, "active">, { title: string; body: string; tone: "info" | "warning" | "danger" }> = {
  unavailable: {
    title: "Annonce indiquée comme indisponible",
    body: "L’annonceur indique que ce bien ou ce service n’est plus disponible. Le contact est désactivé.",
    tone: "warning",
  },
  expired: {
    title: "Cette annonce a expiré",
    body: "Sa durée de diffusion est terminée : elle ne peut plus être sollicitée. Voici des annonces proches.",
    tone: "warning",
  },
  archived: {
    title: "Cette annonce a été retirée",
    body: "L’annonceur ou l’équipe l’a archivée : elle ne peut plus être sollicitée. Voici des annonces proches.",
    tone: "warning",
  },
  pending: {
    title: "En attente de modération",
    body: "Votre annonce sera visible du public après vérification par l’équipe. Seuls vous et l’équipe voyez cette page.",
    tone: "info",
  },
  draft: {
    title: "Brouillon",
    body: "Cette annonce n’est pas encore soumise. Seuls vous et l’équipe voyez cette page.",
    tone: "info",
  },
  rejected: {
    title: "Annonce refusée",
    body: "Cette annonce n’a pas été acceptée par la modération. Seuls vous et l’équipe voyez cette page.",
    tone: "danger",
  },
};

/** État affiché d'une annonce lue par son auteur ou l'équipe. */
export function listingState(listing: {
  status: string;
  expires_at: string | null;
  availability_status: string;
}, now: Date): ListingState {
  switch (listing.status) {
    case "draft":
      return "draft";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "archived":
      return "archived";
    case "expired":
      return "expired";
  }
  if (listing.expires_at && new Date(listing.expires_at).getTime() <= now.getTime()) return "expired";
  return listing.availability_status === "unavailable" ? "unavailable" : "active";
}

export type ContactChannel = "phone" | "whatsapp" | "email";

export const CHANNEL_LABELS: Record<ContactChannel, string> = {
  phone: "Téléphone",
  whatsapp: "WhatsApp",
  email: "E-mail",
};

/** Lien d'ouverture d'une coordonnée révélée (numéros ivoiriens à 10 chiffres → indicatif +225). */
export function contactLink(channel: ContactChannel, value: string): string {
  if (channel === "email") return `mailto:${value.trim()}`;
  const digits = value.replace(/[^\d+]/g, "");
  const international = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : digits.length === 10 ? `225${digits}` : digits;
  return channel === "whatsapp" ? `https://wa.me/${international}` : `tel:+${international}`;
}

export const SAFETY_TIPS = [
  "Ne payez jamais d’avance (acompte, frais de dossier, « réservation ») sans avoir vu le bien ou rencontré la personne.",
  "Rencontrez-vous dans un lieu public et en journée ; visitez un logement avant tout engagement.",
  "Méfiez-vous d’un prix anormalement bas ou d’une urgence imposée.",
  "Gardez vos échanges dans la messagerie : ils pourront servir en cas de signalement.",
] as const;
