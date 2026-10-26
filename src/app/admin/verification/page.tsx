import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isBackOffice } from "@/domain/roles";
import { Alert } from "@/components/ui/feedback";
import { SecondFactorChallenge, SecondFactorSetup } from "@/modules/accounts/components/admin-auth-forms";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getCurrentAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Second facteur — administration",
  robots: { index: false, follow: false },
};

async function VerificationContent({ searchParams }: Pick<PageProps<"/admin/verification">, "searchParams">) {
  const params = await searchParams;
  const requested = safeRedirectPath(typeof params.suivant === "string" ? params.suivant : undefined, href("admin"));
  const next = requested.startsWith(href("admin")) ? requested : href("admin");
  // Pas de requireAccount ici : il renverrait vers cette même page.
  const account = await getCurrentAccount();
  if (!account) redirect(href("adminLogin", { query: { suivant: next } }));
  if (!isBackOffice(account.storedRole)) {
    return (
      <Alert tone="warning" title="Accès refusé">
        Ce compte n’a pas accès à l’administration.
      </Alert>
    );
  }
  if (!account.secondFactorPending) redirect(next);

  const supabase = await createSessionSupabaseClient();
  // Une nouvelle tentative absorbe une coupure réseau passagère vers le service d'authentification.
  let { data, error } = (await supabase?.auth.mfa.listFactors()) ?? { data: null, error: null };
  if (!data || error) ({ data, error } = (await supabase?.auth.mfa.listFactors()) ?? { data: null, error: null });
  // Lecture impossible (réseau, service) : ne jamais proposer de reconfigurer un facteur peut-être existant.
  if (!data || error) {
    return (
      <Alert tone="warning" title="Vérification momentanément indisponible">
        Le service d’authentification ne répond pas. Rechargez la page dans quelques instants.
      </Alert>
    );
  }
  const factor = data.totp.find((item) => item.status === "verified");
  return factor ? (
    <>
      <p className="text-sm text-ink-muted">Ouvrez votre application d’authentification et saisissez le code affiché pour « Carrefour des Possibles ».</p>
      <SecondFactorChallenge factorId={factor.id} next={next} />
      <p className="text-xs text-ink-muted">Téléphone perdu ? Un superadministrateur peut réinitialiser votre second facteur après vérification de votre identité.</p>
    </>
  ) : (
    <>
      <Alert tone="info" title="Configurez votre second facteur">
        Les comptes de l’équipe protègent l’accès à l’administration par un code temporaire, en plus du mot de passe. Cette configuration ne se fait
        qu’une fois.
      </Alert>
      <SecondFactorSetup next={next} />
    </>
  );
}

export default function AdminVerificationPage({ searchParams }: PageProps<"/admin/verification">) {
  return (
    <AuthShell variant="admin" title="Second facteur" description="Une étape de plus pour protéger les données de la plateforme.">
      <Suspense fallback={<FormSkeleton />}>
        <VerificationContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
