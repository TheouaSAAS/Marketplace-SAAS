/**
 * Espace professionnel : étapes vers la publication, définitions des
 * statistiques (agrégats, jamais de donnée de visiteur), statuts des demandes.
 */
import type { TeamRole } from "./pro";
import { ROLE_RANK } from "./pro";

export interface Step {
  label: string;
  done: boolean;
  hint: string;
}

/** Ce qu'il reste à faire pour une page visible, complète et vérifiée — dans l'ordre. */
export function publicationSteps(input: { status: string; complete: boolean; missing: string[]; verified: boolean; verificationPending: boolean }): Step[] {
  const submitted = ["pending", "published"].includes(input.status);
  return [
    { label: "Compléter la page", done: input.complete, hint: input.complete ? "Toutes les rubriques sont remplies." : `Il manque : ${input.missing.join(" ; ").toLowerCase()}.` },
    {
      label: "La soumettre à la modération",
      done: submitted,
      hint: input.status === "rejected" ? "Page refusée : corrigez selon le motif, puis soumettez-la de nouveau." : submitted ? "Soumise." : "Depuis « Modifier la page », bouton « Soumettre à la modération ».",
    },
    { label: "Publication par l’équipe", done: input.status === "published", hint: input.status === "pending" ? "En cours de relecture : vous serez notifié." : input.status === "published" ? "Page en ligne." : "Après soumission." },
    {
      label: "Demander la vérification",
      done: input.verified || input.verificationPending,
      hint: input.verified ? "Page vérifiée." : input.verificationPending ? "Demande en cours d’examen." : input.status === "published" ? "Proposez un élément vérifiable (RCCM, carte professionnelle…)." : "Possible une fois la page publiée.",
    },
  ];
}

export const PRO_STATS_DEFINITIONS = {
  pageViews: { label: "Vues de la page", definition: "Visiteurs distincts ayant ouvert votre page, une fois par jour au plus (estimation, robots et équipe exclus). Comptées depuis la mise en service." },
  pageFavorites: { label: "Favoris de la page", definition: "Personnes qui suivent votre page." },
  requests: { label: "Demandes reçues", definition: "Demandes de devis ou de contact envoyées depuis la page (total et 30 derniers jours)." },
  unanswered: { label: "Demandes à traiter", definition: "Demandes nouvelles ou lues, pas encore marquées « répondue » ni archivées." },
  conversations: { label: "Conversations", definition: "Conversations ouvertes depuis la page dans la messagerie." },
  reviews: { label: "Avis publiés", definition: "Avis relus par la modération ; moyenne affichée publiquement à partir de 3 avis." },
  listingViews: { label: "Vues des annonces", definition: "Somme des vues de vos annonces (même règle que la page)." },
  listingFavorites: { label: "Favoris des annonces", definition: "Total des mises en favori de vos annonces." },
  listingContacts: { label: "Coordonnées vues", definition: "Fois où un membre connecté a affiché les coordonnées d’une de vos annonces." },
} as const;

export const PRIVACY_NOTE = "Ces chiffres sont des totaux : ils ne disent jamais qui a vu, aimé ou consulté. Seules les demandes que les clients vous ont envoyées portent leurs coordonnées, avec leur accord.";

export const REQUEST_STATUSES = {
  new: { label: "Nouvelle", tone: "info" },
  read: { label: "Lue", tone: "neutral" },
  replied: { label: "Répondue", tone: "success" },
  archived: { label: "Archivée", tone: "neutral" },
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUSES;

/** Gestes permis par rôle dans l'espace (la base les garantit aussi). */
export function workspaceRights(role: TeamRole) {
  return {
    canManageListings: ROLE_RANK[role] >= ROLE_RANK.editor,
    canHandleRequests: ROLE_RANK[role] >= ROLE_RANK.editor,
    canManageTeam: ROLE_RANK[role] >= ROLE_RANK.admin,
  };
}
