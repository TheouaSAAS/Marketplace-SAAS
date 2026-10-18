import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { SignupForm } from "@/modules/accounts/components/signup-form";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Créer un compte"
      description="Gratuit. La consultation du site reste possible sans compte."
      footer={
        <p>
          Déjà inscrit ?{" "}
          <Link href={href("login")} className="font-semibold text-brand-700 hover:underline">
            Se connecter
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
