/**
 * Rôles (§3.7). « visitor » n'existe pas en base : c'est l'absence de session.
 * Les valeurs persistées correspondent à l'enum SQL `public.user_role`.
 */
export const USER_ROLES = ["user", "professional", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type Actor = UserRole | "visitor";

export const ROLE_LABELS: Record<Actor, string> = {
  visitor: "Visiteur",
  user: "Utilisateur",
  professional: "Professionnel",
  moderator: "Modérateur",
  admin: "Administrateur",
};

export function isStaff(role: Actor): boolean {
  return role === "moderator" || role === "admin";
}
