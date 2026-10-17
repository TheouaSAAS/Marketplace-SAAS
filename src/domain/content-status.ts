import { isStaff, type Actor } from "./roles";

/**
 * Cycle de vie des contenus publiés (annonces, lieux, événements, fiches pro).
 * Valeurs identiques à l'enum SQL `public.content_status`.
 * La même règle est appliquée côté base par le déclencheur
 * `enforce_content_status_transition` : ce module sert à l'interface et aux
 * actions serveur, la base reste l'autorité finale.
 */
export const CONTENT_STATUSES = ["draft", "pending", "published", "rejected", "expired", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const CONTENT_STATUS_META: Record<ContentStatus, { label: string; tone: StatusTone; description: string }> = {
  draft: { label: "Brouillon", tone: "neutral", description: "Visible uniquement par vous." },
  pending: { label: "En attente", tone: "info", description: "En cours de vérification par l’équipe de modération." },
  published: { label: "Publiée", tone: "success", description: "Visible par tous les visiteurs." },
  rejected: { label: "Rejetée", tone: "danger", description: "Refusée par la modération ; consultez le motif." },
  expired: { label: "Expirée", tone: "warning", description: "La durée de diffusion est écoulée." },
  archived: { label: "Archivée", tone: "neutral", description: "Retirée par son auteur ou l’équipe." },
};

/** Transitions autorisées au propriétaire du contenu. */
const OWNER_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["pending", "archived"],
  pending: ["draft", "archived"],
  published: ["archived"],
  rejected: ["draft", "pending", "archived"],
  expired: ["pending", "archived"],
  archived: ["draft"],
};

/** Transitions autorisées à la modération (en plus de celles du propriétaire). */
const STAFF_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["pending", "archived"],
  pending: ["published", "rejected", "archived"],
  published: ["rejected", "expired", "archived"],
  rejected: ["pending", "published", "archived"],
  expired: ["published", "archived"],
  archived: ["published", "draft"],
};

export function canTransition(
  from: ContentStatus,
  to: ContentStatus,
  context: { actor: Actor; isOwner: boolean },
): boolean {
  if (from === to) return false;
  if (isStaff(context.actor) && STAFF_TRANSITIONS[from].includes(to)) return true;
  if (context.isOwner && context.actor !== "visitor") return OWNER_TRANSITIONS[from].includes(to);
  return false;
}

/** Statuts qu'un auteur peut choisir à la création (jamais « publiée » directement). */
export const INITIAL_STATUSES_FOR_OWNER: readonly ContentStatus[] = ["draft", "pending"];
