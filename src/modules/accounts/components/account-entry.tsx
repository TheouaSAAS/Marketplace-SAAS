import { LogIn, UserRound } from "lucide-react";
import { href } from "@/config/routes";
import { ButtonLink } from "@/components/ui/button";
import { getAccountSummary } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";
import { AccountMenu } from "./account-menu";

/** Point d'entrée du compte dans l'en-tête (lit la session : à placer sous <Suspense>). */
export async function AccountEntry({ variant }: { variant: "desktop" | "mobile" }) {
  if (!isFeatureEnabled("accounts")) return null;
  const account = await getAccountSummary();

  if (!account) {
    return (
      <ButtonLink
        href={href("login")}
        variant={variant === "desktop" ? "ghost" : "secondary"}
        icon={<LogIn aria-hidden className="h-4 w-4" />}
        fullWidth={variant === "mobile"}
      >
        Connexion
      </ButtonLink>
    );
  }
  if (variant === "mobile") {
    return (
      <ButtonLink href={href("profile")} variant="secondary" icon={<UserRound aria-hidden className="h-4 w-4" />} fullWidth>
        Mon profil
      </ButtonLink>
    );
  }
  return <AccountMenu name={account.name} avatarUrl={account.avatarUrl} />;
}

/** Remplaçant pendant la lecture de la session : même encombrement, pas de saut de mise en page. */
export function AccountEntryFallback({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <span
      aria-hidden="true"
      className={variant === "desktop" ? "inline-block h-11 w-28 animate-pulse rounded-control bg-sand-100" : "block h-11 w-full animate-pulse rounded-control bg-sand-100"}
    />
  );
}
