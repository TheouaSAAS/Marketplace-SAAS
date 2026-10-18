/**
 * Rôles. « visitor » n'existe pas en base : c'est l'absence de session.
 * Les valeurs persistées correspondent à l'enum SQL `public.user_role`
 * (alignement vérifié par `schema-alignment.test.ts`).
 *
 * Répartition (moindre privilège) :
 * - moderator     : modère les contenus des membres et les signalements ;
 * - local_editor  : crée, corrige et vérifie les données locales ;
 * - admin         : comptes, organisations, référentiel (sans créer d'admin) ;
 * - superadmin    : tout, dont l'attribution des rôles d'administration.
 */
export const USER_ROLES = ["user", "professional", "local_editor", "moderator", "admin", "superadmin"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type Actor = UserRole | "visitor";

export const ROLE_LABELS: Record<Actor, string> = {
  visitor: "Visiteur",
  user: "Membre",
  professional: "Professionnel",
  local_editor: "Éditeur local",
  moderator: "Modérateur",
  admin: "Administrateur",
  superadmin: "Superadministrateur",
};

/** Modère les contenus des membres (miroir de `public.is_staff()`). */
export function isStaff(role: Actor): boolean {
  return role === "moderator" || role === "admin" || role === "superadmin";
}

/** Crée et vérifie les données locales (miroir de `public.is_curator()`). */
export function isCurator(role: Actor): boolean {
  return role === "local_editor" || role === "admin" || role === "superadmin";
}

export function isAdmin(role: Actor): boolean {
  return role === "admin" || role === "superadmin";
}

/** Rôles qu'un acteur peut attribuer (miroir de `protect_profile_privileges`). */
export function assignableRoles(actor: Actor): readonly UserRole[] {
  if (actor === "superadmin") return USER_ROLES;
  if (actor === "admin") return ["user", "professional", "local_editor", "moderator"];
  return [];
}
