import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { NewPasswordForm } from "@/modules/accounts/components/password-forms";
import { getSessionUser } from "@/server/auth";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false },
};

/** Accessible après le lien de réinitialisation (session temporaire de récupération). */
async function NewPasswordContent() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Alert
        tone="warning"
        title="Lien expiré"
        action={<ButtonLink href={href("forgotPassword")} variant="secondary">Demander un nouveau lien</ButtonLink>}
      >
        Pour choisir un nouveau mot de passe, ouvrez le lien reçu par e-mail (valable une heure).
      </Alert>
    );
  }
  return <NewPasswordForm />;
}

export default function NewPasswordPage() {
  return (
    <AuthShell
      title="Nouveau mot de passe"
      footer={
        <Link href={href("profile")} className="font-semibold text-brand-700 hover:underline">
          Aller à mon profil
        </Link>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <NewPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
