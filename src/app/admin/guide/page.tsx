import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { isCurator } from "@/domain/roles";
import { VERIFICATION_META } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listArticlesForEditing, type EditorialRow } from "@/modules/guide/server/editorial";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Guide : rédaction — administration",
  robots: { index: false, follow: false },
};

/** Équipe locale (éditeurs locaux, administrateurs) : l'interface le vérifie, la base le garantit. */
async function EditorialContent() {
  const account = await requireAccount(href("adminGuide"));
  if (!isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe locale.
      </Alert>
    );
  }
  let rows: EditorialRow[];
  try {
    rows = await listArticlesForEditing();
  } catch (error) {
    logger.error("Rédaction du guide indisponible", { module: "guide", error });
    return <ErrorState title="Rédaction momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const open = rows.reduce((total, row) => total + row.suggestions.filter((item) => item.status === "open").length, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {rows.length} article{rows.length > 1 ? "s" : ""} · {open} suggestion{open > 1 ? "s" : ""} à examiner
        </p>
        <ButtonLink href={href("adminGuideArticle", { params: { id: "nouveau" } })} icon={<Plus aria-hidden className="h-4 w-4" />}>
          Nouvel article
        </ButtonLink>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucun article" description="Commencez par une rubrique très demandée : se loger, se déplacer, santé." />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const pending = row.suggestions.filter((item) => item.status === "open").length;
            const verification = VERIFICATION_META[row.verification_status];
            return (
              <li key={row.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4">
                <Link className="font-bold underline" href={href("adminGuideArticle", { params: { id: row.id } })}>
                  {row.title}
                </Link>
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Badge tone={CONTENT_STATUS_META[row.status].tone}>{CONTENT_STATUS_META[row.status].label}</Badge>
                  <Badge tone={row.verification_status === "verified" ? "success" : "warning"}>{verification.label}</Badge>
                  <span>
                    {row.section.name} · version {row.version} · {formatDate(row.updated_at)}
                  </span>
                  {pending > 0 && <Badge tone="info">{pending} suggestion{pending > 1 ? "s" : ""}</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminGuidePage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Guide : rédaction" }]} />
      <h1 className="text-3xl font-extrabold">Guide : rédaction et suggestions</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <EditorialContent />
      </Suspense>
    </Container>
  );
}
