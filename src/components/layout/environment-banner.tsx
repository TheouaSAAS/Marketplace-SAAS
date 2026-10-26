import { APP_ENVIRONMENTS, resolveAppEnvironment } from "@/config/environment";

/**
 * Bandeau de préproduction : personne ne doit confondre ce site avec la
 * plateforme réelle (données de test, e-mails et paiements éventuellement réels).
 */
export function EnvironmentBanner() {
  const environment = resolveAppEnvironment();
  if (environment !== "preview") return null;
  return (
    <p role="note" className="bg-accent-600 px-4 py-1.5 text-center text-sm font-semibold text-white">
      {APP_ENVIRONMENTS[environment]} : site de test, données non validées. N’y faites aucune vraie transaction.
    </p>
  );
}
