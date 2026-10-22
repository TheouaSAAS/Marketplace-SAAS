import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { displayedVerification, isReliable } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { availabilityText } from "@/modules/services/domain/present";
import { ReportForm } from "@/modules/listings/components/report-form";
import { QuoteForm } from "@/modules/services/components/quote-form";
import { getPublicBusiness } from "@/modules/services/server/queries";

type Props = PageProps<"/professionnels/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getPublicBusiness(slug);
  if (!pro) return { title: "Professionnel", robots: { index: false, follow: true } };
  return {
    title: pro.name,
    description: (pro.description ?? pro.services.join(", ")).slice(0, 160),
    robots: pro.verification_status === "placeholder" ? { index: false, follow: true } : undefined,
  };
}

async function Professional({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const pro = await getPublicBusiness(slug);
  if (!pro) notFound();
  const now = new Date();
  const back = href("professionalDetail", { params: { slug } });
  const hoursReliable = isReliable(pro.verification_status, pro.verified_at, now, "opening_hours");
  const availability = availabilityText(pro.availability_note, pro.availability_declared_at, now);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Services de proximité", href: href("services") }, { label: pro.name }]} />
      {pro.verification_status === "placeholder" && (
        <Alert tone="warning" title="Exemple de démonstration">
          Cette fiche est fictive et sert à tester la plateforme : ne vous y fiez pas.
        </Alert>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <VerificationBadge status={displayedVerification(pro.verification_status, pro.verified_at, now)} />
            <h1 className="text-2xl font-extrabold sm:text-3xl">{pro.name}</h1>
            <p className="text-ink-muted">{[pro.category?.name, pro.neighborhood?.name, pro.city?.name].filter(Boolean).join(" · ")}</p>
          </div>
          {pro.description && <p className="whitespace-pre-line">{pro.description}</p>}
          {pro.services.length > 0 && (
            <section aria-labelledby="prestations">
              <h2 id="prestations" className="mb-2 text-xl font-bold">
                Prestations
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {pro.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="zone" className="flex flex-col gap-1">
            <h2 id="zone" className="text-xl font-bold">
              Zone desservie et disponibilité
            </h2>
            <p>{pro.service_area ?? "Zone non précisée par le professionnel."}</p>
            <p className="text-sm text-ink-muted">{availability ?? "Aucune disponibilité déclarée."} Rien n’est garanti en temps réel.</p>
          </section>
          <section aria-labelledby="horaires" className="flex flex-col gap-1">
            <h2 id="horaires" className="text-xl font-bold">
              Horaires
            </h2>
            <p className="text-sm text-ink-muted">
              {hoursReliable
                ? `Horaires vérifiés le ${formatDate(pro.verified_at!)} : demandez-les au professionnel en attendant leur affichage détaillé.`
                : "Horaires non affichés tant qu’ils n’ont pas été vérifiés par l’équipe locale."}
            </p>
          </section>
          <p className="text-xs text-ink-subtle">Fiche mise à jour le {formatDate(pro.updated_at)}. Photos de réalisations : bientôt.</p>
        </div>
        <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Contacter">
          <h2 className="text-lg font-bold">Demander un devis</h2>
          {pro.accepts_quotes ? (
            <QuoteForm businessId={pro.id} back={back} services={pro.services} />
          ) : (
            <p className="text-sm text-ink-muted">Ce professionnel ne reçoit pas de demandes de devis en ligne.</p>
          )}
          <ReportForm target={{ professionnel: pro.id }} back={back} label="Signaler cette fiche" />
        </aside>
      </div>
    </div>
  );
}

export default function ProfessionalPage({ params }: Props) {
  return (
    <Container className="py-6 sm:py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Professional params={params} />
      </Suspense>
    </Container>
  );
}
