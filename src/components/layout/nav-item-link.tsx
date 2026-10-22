import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { categoryHref, hasPage, href, type RouteKey } from "@/config/routes";
import type { NavLink } from "@/config/navigation";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { SoonBadge } from "@/components/ui/badge";

export function navLinkHref(link: NavLink): string {
  return categoryHref(link.route, link.category, link.hash);
}

/**
 * Lien de menu qui respecte le statut de la route : actif si une page existe
 * (`live` ou `preview`), sinon affiché « Bientôt » et non cliquable (jamais de lien cassé).
 */
export function NavItemLink({
  link,
  className,
  onNavigate,
}: {
  link: NavLink;
  className?: string;
  onNavigate?: () => void;
}) {
  if (!hasPage(link.route)) {
    return (
      <span aria-disabled="true" className={cn("cursor-default text-ink-subtle", className)}>
        <span>{link.label}</span>
        <SoonBadge className="ml-2" />
      </span>
    );
  }
  return (
    <Link href={navLinkHref(link)} className={className} onClick={onNavigate}>
      {link.label}
    </Link>
  );
}

/** Bouton d'action vers une route : désactivé avec une explication tant que la page n'existe pas. */
export function RouteButton({
  route,
  variant,
  size,
  icon,
  fullWidth,
  className,
  onNavigate,
  children,
}: {
  route: RouteKey;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  if (!hasPage(route)) {
    return (
      <Button variant={variant} size={size} icon={icon} fullWidth={fullWidth} className={className} disabled title="Bientôt disponible">
        {children}
      </Button>
    );
  }
  return (
    <ButtonLink href={href(route)} variant={variant} size={size} icon={icon} fullWidth={fullWidth} className={className} onClick={onNavigate}>
      {children}
    </ButtonLink>
  );
}
