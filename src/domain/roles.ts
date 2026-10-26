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

/** Rôles du back-office (modération, données locales, administration). */
export const BACKOFFICE_ROLES: readonly UserRole[] = ["local_editor", "moderator", "admin", "superadmin"];

export function isBackOffice(role: Actor): boolean {
  return (BACKOFFICE_ROLES as readonly Actor[]).includes(role);
}

/**
 * Rôle effectif (miroir de `public.current_user_role()`) : un rôle du
 * back-office n'agit qu'après le second facteur (session « aal2 ») quand la
 * plateforme l'exige ; avant, le compte agit comme un simple membre.
 */
export function effectiveRole(stored: UserRole, assurance: string | null | undefined, secondFactorRequired: boolean): UserRole {
  if (isBackOffice(stored) && secondFactorRequired && assurance !== "aal2") return "user";
  return stored;
}
