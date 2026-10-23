import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { logger } from "@/lib/logger";
import { CandidateProfileForm } from "@/modules/jobs/components/job-forms";
import { getMyCandidateProfile } from "@/modules/jobs/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mon profil candidat",
  robots: { index: false, follow: false },
};

async function Profile() {
  const account = await requireAccount(href("candidateProfile"));
  let profile: Awaited<ReturnType<typeof getMyCandidateProfile>>;
  try {
    profile = await getMyCandidateProfile(account.id);
  } catch (error) {
    logger.error("Profil candidat indisponible", { module: "emploi", error });
    return <ErrorState title="Profil momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return <CandidateProfileForm key={profile?.updated_at ?? "nouveau"} draft={profile ?? {}} />;
}

export default function CandidateProfilePage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités", href: href("jobs") }, { label: "Mon profil candidat" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Mon profil candidat</h1>
        <p className="text-ink-muted">
          Privé par défaut. Vous choisissez qui le voit (personne, les employeurs connectés, tout le monde) et si vos coordonnées peuvent être affichées.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Profile />
      </Suspense>
    </Container>
  );
}
