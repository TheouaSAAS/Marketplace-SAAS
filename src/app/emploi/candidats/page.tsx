import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DOMAINS, EXPERIENCE } from "@/modules/jobs/domain/attributes";
import { RevealContactButton } from "@/modules/jobs/components/job-forms";
import { listVisibleCandidates, type CandidateProfile } from "@/modules/jobs/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Profils candidats",
  robots: { index: false, follow: false },
};

const label = <T extends Record<string, string>>(table: T, value: string | null) => (value && Object.hasOwn(table, value) ? table[value as keyof T] : null);

/** Profils que la personne a le droit de voir (règle en base) : publics, ou « employeurs » pour un compte employeur. */
async function Candidates() {
  await requireAccount(href("candidates"));
  let profiles: CandidateProfile[];
  try {
    profiles = await listVisibleCandidates();
  } catch (error) {
    logger.error("Profils candidats indisponibles", { module: "emploi", error });
    return <ErrorState title="Profils momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (profiles.length === 0) {
    return (
      <EmptyState
        title="Aucun profil visible pour vous"
        description="Les candidats choisissent qui voit leur profil. Les profils réservés aux employeurs ne s’affichent qu’aux comptes professionnels."
      />
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {profiles.map((profile) => (
        <li key={profile.user_id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={profile.available ? "success" : "neutral"}>{profile.available ? "Disponible" : "En poste"}</Badge>
            {label(EXPERIENCE, profile.experience) && <Badge tone="neutral">{label(EXPERIENCE, profile.experience)}</Badge>}
          </div>
          <h2 className="font-bold">{profile.headline}</h2>
          {profile.summary && <p className="line-clamp-4 text-sm">{profile.summary}</p>}
          {profile.skills.length > 0 && <p className="text-sm text-ink-muted">Compétences : {profile.skills.join(", ")}</p>}
          {profile.domains.length > 0 && <p className="text-sm text-ink-muted">Domaines : {profile.domains.map((domain) => label(DOMAINS, domain)).filter(Boolean).join(", ")}</p>}
          <p className="text-xs text-ink-subtle">Mis à jour le {formatDate(profile.updated_at)}</p>
          {profile.share_contact ? (
            <RevealContactButton candidateId={profile.user_id} />
          ) : (
            <p className="text-xs text-ink-muted">Ce candidat ne partage pas ses coordonnées.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CandidatesPage() {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités", href: href("jobs") }, { label: "Profils candidats" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Profils candidats</h1>
        <p className="max-w-2xl text-ink-muted">
          Seuls les profils que leurs auteurs ont rendus visibles. Les coordonnées ne s’affichent qu’à un compte employeur et seulement si le candidat
          l’a accepté. Aucun classement automatique.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Candidates />
      </Suspense>
    </Container>
  );
}
