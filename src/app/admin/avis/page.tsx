import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ReviewModerationForm } from "@/modules/businesses/components/pro-forms";
import { listPendingReviews } from "@/modules/businesses/server/pro-queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Avis à modérer — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const DECISIONS: Record<string, string> = {
  publie: "Avis publié : son auteur et le professionnel sont notifiés.",
  refuse: "Avis refusé : son auteur est notifié.",
};

async function Queue({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await requireAccount(href("adminReviews"));
  if (!isStaff(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe de modération.
      </Alert>
    );
  }
  const decision = (await searchParams).decision;
  const notice = typeof decision === "string" ? DECISIONS[decision] : undefined;
  let reviews: Awaited<ReturnType<typeof listPendingReviews>>;
  try {
    reviews = await listPendingReviews();
  } catch (error) {
    logger.error("File des avis indisponible", { module: "pages-pro", error });
    return <ErrorState title="File des avis momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      <p className="text-sm text-ink-muted">
        Publiez un avis qui décrit une expérience vécue. Refusez les insultes, les données personnelles, les accusations sans fait précis, les avis
        manifestement achetés ou rédigés par un concurrent.
      </p>
      {reviews.length === 0 ? (
        <EmptyState title="Aucun avis en attente" description="Les nouveaux avis apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <li key={review.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <p className="text-sm">
                <span className="font-semibold">{review.rating}/5</span> ·{" "}
                {review.business ? (
                  <Link href={href("professionalDetail", { params: { slug: review.business.slug } })} className="underline">
                    {review.business.name}
                  </Link>
                ) : (
                  "Page retirée"
                )}{" "}
                · {formatDateTime(review.created_at)}
              </p>
              {review.body ? <p className="whitespace-pre-line text-sm">{review.body}</p> : <p className="text-sm text-ink-muted">Note sans commentaire.</p>}
              <ReviewModerationForm reviewId={review.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminReviewsPage({ searchParams }: PageProps<"/admin/avis">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Avis à modérer" }]} />
      <h1 className="text-3xl font-extrabold">Avis à modérer</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
