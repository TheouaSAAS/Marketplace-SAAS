/**
 * Disponibilité d'un bien, déclarée par l'annonceur depuis son espace
 * personnel. Distincte du statut de publication : une annonce publiée peut
 * être « Non disponible » (logement loué) puis redevenir « Disponible ».
 * La plateforme ne la vérifie pas.
 */
export type AvailabilityStatus = "available" | "reserved" | "unavailable" | "unknown";

export const AVAILABILITY_BADGES: Record<AvailabilityStatus, { label: string; tone: "success" | "warning" | "neutral" } | null> = {
  available: { label: "Disponible", tone: "success" },
  reserved: { label: "Réservé", tone: "warning" },
  unavailable: { label: "Non disponible", tone: "neutral" },
  unknown: null,
};

/** Mention qui accompagne la disponibilité partout où elle est affichée en détail. */
export const AVAILABILITY_NOTE = "Disponibilité déclarée par l’annonceur, non vérifiée par la plateforme.";

/** Libellé en clair, y compris lorsque l'annonceur ne l'a pas précisée. */
export function availabilityText(status: AvailabilityStatus): string {
  return AVAILABILITY_BADGES[status]?.label ?? "Non précisée";
}
