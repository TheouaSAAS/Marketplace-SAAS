import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FileText } from "lucide-react";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { logger } from "@/lib/logger";
import { QUOTE_STATUSES, quoteDetails } from "@/modules/services/domain/quote";
import { QuoteStatusForm } from "@/modules/services/components/quote-status-form";
import { listMyQuotes, type QuoteRequest } from "@/modules/services/server/quotes";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mes demandes de devis",
  robots: { index: false, follow: false },
};

function QuoteSummary({ quote }: { quote: QuoteRequest }) {
  const details = quoteDetails(quote.details);
  return (
    <>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {details.prestation && (
          <>
            <dt className="text-ink-muted">Prestation</dt>
            <dd>{details.prestation}</dd>
          </>
        )}
        {details.quand && (
          <>
            <dt className="text-ink-muted">Délai souhaité</dt>
            <dd>{details.quand}</dd>
          </>
        )}
        {details.quartier && (
          <>
            <dt className="text-ink-muted">Quartier</dt>
            <dd>{details.quartier}</dd>
          </>
        )}
      </dl>
      <p className="whitespace-pre-line">{quote.message}</p>
    </>
  );
}

function QuoteHeader({ quote, title }: { quote: QuoteRequest; title: ReactNode }) {
  const status = QUOTE_STATUSES[quote.status];
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex flex-col">
        <h3 className="font-bold">{title}</h3>
        <p className="text-xs text-ink-muted">Envoyée le {formatDateTime(quote.created_at)}</p>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </div>
  );
}

function Received({ quotes }: { quotes: QuoteRequest[] }) {
  return (
    <section aria-labelledby="recues" className="flex flex-col gap-3">
      <h2 id="recues" className="text-xl font-bold">
        Demandes reçues ({quotes.length})
      </h2>
      <p className="text-sm text-ink-muted">
        Coordonnées transmises avec l’accord explicite de la personne, pour répondre à sa demande uniquement : ne les utilisez pas à d’autres fins.
      </p>
      <ul className="flex flex-col gap-3">
        {quotes.map((quote) => (
          <li key={quote.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <QuoteHeader quote={quote} title={`${quote.sender_name}${quote.business ? ` → ${quote.business.name}` : ""}`} />
            <QuoteSummary quote={quote} />
            <div className="flex flex-col gap-1 rounded-control bg-surface-muted p-3 text-sm">
              {quote.sender_phone && (
                <p>
                  Téléphone : <a className="font-medium underline" href={`tel:${quote.sender_phone.replace(/\s+/g, "")}`}>{quote.sender_phone}</a>
                </p>
              )}
              {quote.sender_email && (
                <p>
                  E-mail : <a className="font-medium underline" href={`mailto:${quote.sender_email}`}>{quote.sender_email}</a>
                </p>
              )}
              {quote.consented_at && <p className="text-xs text-ink-muted">Accord de transmission donné le {formatDateTime(quote.consented_at)}.</p>}
            </div>
            <QuoteStatusForm quoteId={quote.id} status={quote.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sent({ quotes }: { quotes: QuoteRequest[] }) {
  return (
    <section aria-labelledby="envoyees" className="flex flex-col gap-3">
      <h2 id="envoyees" className="text-xl font-bold">
        Demandes envoyées ({quotes.length})
      </h2>
      <p className="text-sm text-ink-muted">Le statut est mis à jour par le professionnel ; il vous répond avec les coordonnées que vous avez indiquées.</p>
      <ul className="flex flex-col gap-3">
        {quotes.map((quote) => (
          <li key={quote.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <QuoteHeader
              quote={quote}
              title={
                quote.business ? (
                  <Link className="underline" href={href("professionalDetail", { params: { slug: quote.business.slug } })}>
                    {quote.business.name}
                  </Link>
                ) : (
                  "Professionnel retiré de l’annuaire"
                )
              }
            />
            <QuoteSummary quote={quote} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Espace protégé : la session est vérifiée ici (le proxy ne fait qu'un contrôle optimiste). */
async function QuotesContent() {
  const account = await requireAccount(href("quoteRequests"));
  let quotes: Awaited<ReturnType<typeof listMyQuotes>>;
  try {
    quotes = await listMyQuotes(account.id);
  } catch (error) {
    logger.error("Lecture des demandes de devis impossible", { module: "services", error });
    return <ErrorState title="Vos demandes sont momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (quotes.sent.length === 0 && quotes.received.length === 0) {
    return (
      <EmptyState
        icon={<FileText aria-hidden className="h-6 w-6" />}
        title="Aucune demande de devis"
        description="Depuis la fiche d’un professionnel, « Demander un devis » envoie votre besoin ; vous le retrouverez ici."
        action={<ButtonLink href={href("services")}>Trouver un professionnel</ButtonLink>}
      />
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {quotes.received.length > 0 && <Received quotes={quotes.received} />}
      {quotes.sent.length > 0 && <Sent quotes={quotes.sent} />}
    </div>
  );
}

export default function QuoteRequestsPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Mes demandes de devis" }]} />
      <h1 className="text-3xl font-extrabold">Mes demandes de devis</h1>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <QuotesContent />
      </Suspense>
    </Container>
  );
}
