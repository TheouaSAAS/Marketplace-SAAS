import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { ForgotPasswordForm } from "@/modules/accounts/components/password-forms";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oublié"
      description="Indiquez l’adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={
        <Link href={href("login")} className="font-semibold text-brand-700 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
