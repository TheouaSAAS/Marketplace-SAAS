import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { AuthShell } from "@/modules/accounts/components/auth-shell";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { SignupForm } from "@/modules/accounts/components/signup-form";
import { proCategories } from "@/modules/businesses/server/pro-queries";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false },
};

/** Secteurs proposés au profil professionnel : ceux de la création de page professionnelle (référentiel administrable). */
async function SignupContent() {
  const categories = await proCategories().catch((error: unknown) => {
    logger.warn("Secteurs d'activité indisponibles à l'inscription", { module: "comptes", error });
    return [];
  });
  return <SignupForm categories={categories} />;
}

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
      <Suspense fallback={<FormSkeleton />}>
        <SignupContent />
      </Suspense>
    </AuthShell>
  );
}
