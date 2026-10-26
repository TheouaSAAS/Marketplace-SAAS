import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isBackOffice } from "@/domain/roles";
import { Alert } from "@/components/ui/feedback";
import { AdminLoginForm } from "@/modules/accounts/components/admin-auth-forms";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { getCurrentAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Connexion à l’administration",
  robots: { index: false, follow: false },
};

async function AdminLoginContent({ searchParams }: Pick<PageProps<"/admin/connexion">, "searchParams">) {
  const params = await searchParams;
  const requested = safeRedirectPath(typeof params.suivant === "string" ? params.suivant : undefined, href("admin"));
  const next = requested === href("admin") || requested.startsWith(`${href("admin")}/`) ? requested : href("admin");
  const account = await getCurrentAccount();
  if (account && isBackOffice(account.storedRole)) {
    redirect(account.secondFactorPending ? href("adminVerify", { query: { suivant: next } }) : next);
  }
  return (
    <>
      {account && (
        <Alert tone="warning" title="Accès refusé">
          Le compte connecté n’a pas accès à l’administration. Connectez-vous avec un compte de l’équipe.
        </Alert>
      )}
      <AdminLoginForm next={next} />
      <p className="text-xs text-ink-muted">
        Réservé aux comptes de l’équipe (modération, données locales, administration), attribués par un administrateur. Un second facteur est demandé
        après le mot de passe. Les connexions sont journalisées.
      </p>
    </>
  );
}

/** Entrée du back-office : même identité graphique, accès clairement signalé, jamais ouvert par l'inscription. */
export default function AdminLoginPage({ searchParams }: PageProps<"/admin/connexion">) {
  return (
    <AuthShell
      variant="admin"
      title="Connexion à l’administration"
      description="Modération, données locales et gestion de la plateforme."
      footer={
        <p>
          Vous cherchez votre compte personnel ?{" "}
          <Link href={href("login")} className="font-semibold text-brand-700 hover:underline">
            Connexion des membres
          </Link>
        </p>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <AdminLoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}
