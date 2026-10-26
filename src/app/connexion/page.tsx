import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { LoginForm } from "@/modules/accounts/components/login-form";
import { ResendConfirmation } from "@/modules/accounts/components/resend-confirmation";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getSessionUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function LoginContent({ searchParams }: Pick<PageProps<"/connexion">, "searchParams">) {
  const params = await searchParams;
  const next = safeRedirectPath(first(params.suivant), href("profile"));
  if (await getSessionUser()) redirect(next);

  return (
    <>
      {first(params.erreur) === "lien" && (
        <div className="flex flex-col gap-3">
          <Alert tone="warning" title="Lien invalide, expiré ou déjà utilisé">
            Un lien de confirmation dure une heure et ne sert qu’une fois. Si votre adresse est déjà confirmée, connectez-vous ; sinon, demandez un
            nouvel e-mail.
          </Alert>
          <ResendConfirmation />
        </div>
      )}
      {first(params.suivant) && (
        <Alert tone="info">Connectez-vous pour accéder à cette page.</Alert>
      )}
      <LoginForm next={next} />
    </>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <AuthShell
      title="Connexion"
      description="Retrouvez vos annonces, favoris et messages. Les visiteurs explorent le site sans compte."
      footer={
        <p>
          Pas encore de compte ?{" "}
          <Link href={href("signup")} className="font-semibold text-brand-700 hover:underline">
            Créer un compte
          </Link>
        </p>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
