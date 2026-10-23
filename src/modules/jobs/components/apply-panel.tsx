import Link from "next/link";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { href } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/feedback";
import { safeApplyLink } from "../domain/attributes";
import { getMyApplicationStatus } from "../server/queries";
import { ApplyForm } from "./job-forms";

const STATUS_LABELS: Record<string, string> = {
  submitted: "envoyée",
  viewed: "vue par l’employeur",
  shortlisted: "retenue pour la suite",
  rejected: "non retenue",
  withdrawn: "retirée",
};

/**
 * Candidater à une offre : formulaire interne (visible du seul employeur) ou
 * lien externe https affiché avec le nom du site. Une offre close, expirée ou
 * dont la date limite est passée n'accepte plus de candidature (règle en base).
 */
export async function JobApplyPanel({
  listingId,
  attributes,
  active,
  isOwner,
  userId,
  back,
  now,
}: {
  listingId: string;
  attributes: Record<string, unknown>;
  active: boolean;
  isOwner: boolean;
  userId: string | null;
  back: string;
  now: Date;
}) {
  const deadline = typeof attributes.date_limite === "string" ? attributes.date_limite : null;
  const open = active && (!deadline || deadline >= now.toISOString().slice(0, 10));
  const external = attributes.candidature === "externe" ? safeApplyLink(attributes.lien_candidature) : null;
  let content;
  if (!open) {
    content = <p className="text-sm text-ink-muted">Cette offre est close ou expirée : elle n’accepte plus de candidature.</p>;
  } else if (isOwner) {
    content = (
      <Link href={href("receivedApplications")} className="text-sm font-semibold underline">
        Voir les candidatures reçues
      </Link>
    );
  } else if (attributes.candidature === "externe") {
    content = external ? (
      <div className="flex flex-col gap-2">
        <a
          href={external.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          Candidater sur {external.host}
        </a>
        <p className="text-xs text-ink-muted">Vous quittez la plateforme pour le site de l’employeur.</p>
      </div>
    ) : (
      <p className="text-sm text-ink-muted">Lien de candidature indisponible : contactez l’employeur par la messagerie.</p>
    );
  } else {
    const status = userId ? await getMyApplicationStatus(listingId, userId) : null;
    content = status ? (
      <p className="text-sm">
        Votre candidature est {STATUS_LABELS[status] ?? status}.{" "}
        <Link href={href("myApplications")} className="font-semibold underline">
          Mes candidatures
        </Link>
      </p>
    ) : (
      <ApplyForm offerId={listingId} back={back} />
    );
  }
  return (
    <section aria-labelledby="candidater" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 id="candidater" className="text-xl font-bold">
        Candidater
      </h2>
      {deadline && <p className="text-sm">Date limite : {formatDate(deadline)}</p>}
      {content}
      <Alert tone="warning">
        <span className="flex items-start gap-1.5">
          <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Aucun employeur sérieux ne demande d’argent pour postuler. Signalez toute demande de frais.
        </span>
      </Alert>
    </section>
  );
}
