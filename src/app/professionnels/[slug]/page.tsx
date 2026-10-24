import type { Metadata } from "next";
import { JsonLd } from "@/components/layout/json-ld";
import { detailMetadata, localJsonLd } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExternalLink, Mail, MessageCircle, Phone, Star } from "lucide-react";
import { href } from "@/config/routes";
import { displayedVerification, isReliable } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { ListingCard } from "@/components/content/content-cards";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { availabilityText } from "@/modules/services/domain/present";
import { ReportForm } from "@/modules/listings/components/report-form";
import { ListingGallery } from "@/modules/listings/components/listing-gallery";
import { contactLink } from "@/modules/listings/domain/presentation";
import { QuoteForm } from "@/modules/services/components/quote-form";
import { getPublicBusiness } from "@/modules/services/server/queries";
import { ClaimForm } from "@/modules/shops/components/place-actions";
import { parseOpeningHours, weekLines } from "@/modules/shops/domain/hours";
import { completeness, proBadges } from "@/modules/businesses/domain/pro";
import { ProBadgeList } from "@/modules/businesses/components/pro-badges";
import { ReviewForm } from "@/modules/businesses/components/pro-forms";
import { getProPublicExtras, listProListings } from "@/modules/businesses/server/pro-queries";
import { getSessionUser } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";
import { recordContentView } from "@/server/views";

type Props = PageProps<"/professionnels/[slug]">;

/** Moyenne affichée seulement à partir de 3 avis : en dessous, elle ne dit rien. */
const MIN_REVIEWS_FOR_AVERAGE = 3;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const pro = await getPublicBusiness(slug);
  if (!pro) return { title: "Professionnel", robots: { index: false, follow: true } };
  return detailMetadata({ title: pro.name, description: pro.description ?? pro.services.join(", "), path: href("professionalDetail", { params: { slug } }), noindex: pro.verification_status === "placeholder" });
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Professional({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const pro = await getPublicBusiness(slug);
  if (!pro) notFound();
  // Disponibilité, vérification et session jugées à la date de la requête.
  await connection();
  const [extras, user] = await Promise.all([getProPublicExtras(pro.id), getSessionUser()]);
  // Vue comptée après l'envoi de la page ; le titulaire ne compte pas.
  await recordContentView("pro", pro.id, { viewerId: user?.id ?? null, ownerIds: [pro.owner_id] });
  const listings = extras.listingIds.length ? await listProListings(extras.listingIds) : [];
  const now = new Date();
  const back = href("professionalDetail", { params: { slug } });
  const hours = parseOpeningHours(pro.opening_hours);
  const hoursReliable = isReliable(pro.verification_status, pro.verified_at, now, "opening_hours");
  const availability = availabilityText(pro.availability_note, pro.availability_declared_at, now);
  const verification = displayedVerification(pro.verification_status, pro.verified_at, now);
  const complete = completeness({ ...pro, photoCount: extras.photos.length }).complete;
  const badges = proBadges({ verified: false, verificationPending: extras.verificationPending && verification !== "verified", complete, sponsored: extras.sponsored });
  const isOwner = user?.id === pro.owner_id;
  const reviewsEnabled = isFeatureEnabled("reviews");
  const contacts = [
    pro.phone && { label: pro.phone, href: contactLink("phone", pro.phone), icon: Phone, name: "Téléphone" },
    pro.whatsapp && { label: pro.whatsapp, href: contactLink("whatsapp", pro.whatsapp), icon: MessageCircle, name: "WhatsApp" },
    pro.email && { label: pro.email, href: contactLink("email", pro.email), icon: Mail, name: "E-mail" },
  ].filter((item): item is { label: string; href: string; icon: typeof Phone; name: string } => Boolean(item));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Professionnels et entreprises", href: href("directory") }, { label: pro.name }]} />
      <JsonLd
        data={localJsonLd({
          name: pro.name,
          description: pro.description,
          path: back,
          address: null,
          neighborhood: pro.neighborhood?.name ?? null,
          city: pro.city.name,
          telephone: pro.phone,
          website: pro.website,
          categoryName: pro.category?.name ?? null,
          verified: verification === "verified",
        })}
      />
      {pro.verification_status === "placeholder" && (
        <Alert tone="warning" title="Exemple de démonstration">
          Cette fiche est fictive et sert à tester la plateforme : ne vous y fiez pas.
        </Alert>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <VerificationBadge status={verification} />
              <ProBadgeList badges={badges} withLegend />
            </div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{pro.name}</h1>
            <p className="text-ink-muted">{[pro.category?.name, pro.neighborhood?.name, pro.city?.name].filter(Boolean).join(" · ")}</p>
            {reviewsEnabled && extras.rating.count >= MIN_REVIEWS_FOR_AVERAGE && extras.rating.average !== null && (
              <p className="inline-flex items-center gap-1 text-sm font-semibold">
                <Star aria-hidden className="h-4 w-4 fill-accent-400 text-accent-500" />
                {extras.rating.average.toLocaleString("fr-FR")}/5 · {extras.rating.count} avis
              </p>
            )}
          </div>
          {extras.photos.length > 0 && <ListingGallery images={extras.photos} title={pro.name} />}
          {pro.description && <p className="whitespace-pre-line">{pro.description}</p>}
          {pro.services.length > 0 && (
            <Section id="prestations" title="Prestations">
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {pro.services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section id="zone" title="Zone desservie et disponibilité">
            <p>{pro.service_area ?? "Zone non précisée par le professionnel."}</p>
            <p className="text-sm text-ink-muted">{availability ?? "Aucune disponibilité déclarée."} Rien n’est garanti en temps réel.</p>
          </Section>
          <Section id="horaires" title="Horaires">
            {hours ? (
              <>
                <dl className="grid max-w-sm grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-sm">
                  {weekLines(hours).map((line) => (
                    <div key={line.day} className="contents">
                      <dt className="text-ink-muted">{line.label}</dt>
                      <dd>{line.text}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-ink-muted">
                  {hoursReliable ? `Horaires vérifiés le ${formatDate(pro.verified_at!)}.` : "Horaires déclarés par le professionnel, à confirmer avant de vous déplacer."}
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">Horaires non renseignés.</p>
            )}
          </Section>
          {extras.faq.length > 0 && (
            <Section id="faq" title="Questions fréquentes">
              <div className="flex flex-col gap-2">
                {extras.faq.map((item) => (
                  <details key={item.question} className="rounded-control border border-border p-3">
                    <summary className="cursor-pointer font-semibold">{item.question}</summary>
                    <p className="mt-2 whitespace-pre-line text-sm">{item.answer}</p>
                  </details>
                ))}
              </div>
            </Section>
          )}
          {listings.length > 0 && (
            <Section id="annonces" title="Annonces de ce professionnel">
              <ul className="grid gap-4 sm:grid-cols-2">
                {listings.map((listing, index) => (
                  <li key={listing.id}>
                    <ListingCard listing={listing} now={now} index={index} href={href("listingDetail", { params: { slug: listing.slug } })} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {reviewsEnabled && (
            <Section id="avis" title={`Avis (${extras.rating.count})`}>
              <p className="text-xs text-ink-muted">
                Avis relus par l’équipe avant publication. Un seul avis par personne, pas d’avis sur sa propre activité, comptes de plus de 7 jours
                seulement. La moyenne s’affiche à partir de {MIN_REVIEWS_FOR_AVERAGE} avis.
              </p>
              {extras.reviews.length === 0 ? (
                <p className="text-sm text-ink-muted">Aucun avis publié pour l’instant.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {extras.reviews.map((review) => (
                    <li key={review.id} className="flex flex-col gap-1 rounded-control border border-border p-3">
                      <p className="text-sm">
                        <span className="font-semibold">{review.rating}/5</span> · {review.author_name} · {formatDate(review.created_at)}
                      </p>
                      {review.body && <p className="whitespace-pre-line text-sm">{review.body}</p>}
                      {review.response_body && (
                        <div className="ml-3 border-l-2 border-brand-200 pl-3 text-sm">
                          <p className="font-semibold">Réponse du professionnel</p>
                          <p className="whitespace-pre-line">{review.response_body}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!isOwner &&
                (user ? (
                  <details className="rounded-control border border-border p-3">
                    <summary className="cursor-pointer font-semibold">Donner mon avis</summary>
                    <div className="mt-3">
                      <ReviewForm pageId={pro.id} back={back} />
                    </div>
                  </details>
                ) : (
                  <Link href={href("login", { query: { suivant: back } })} className="text-sm font-semibold underline">
                    Connectez-vous pour donner votre avis
                  </Link>
                ))}
            </Section>
          )}
          <p className="text-xs text-ink-subtle">Fiche mise à jour le {formatDate(pro.updated_at)}. Contenu déclaré par le professionnel et relu par l’équipe de modération.</p>
        </div>
        <aside className="flex flex-col gap-4" aria-label="Contacter">
          {(contacts.length > 0 || pro.website || extras.links.length > 0) && (
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <h2 className="text-lg font-bold">Contacts et liens</h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {contacts.map((contact) => (
                  <li key={contact.name}>
                    <a href={contact.href} className="inline-flex items-center gap-2 font-semibold underline">
                      <contact.icon aria-hidden className="h-4 w-4" />
                      <span className="sr-only">{contact.name} : </span>
                      {contact.label}
                    </a>
                  </li>
                ))}
                {[...(pro.website ? [{ label: "Site internet", url: pro.website }] : []), ...extras.links].map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 font-semibold underline">
                      <ExternalLink aria-hidden className="h-4 w-4" />
                      {link.label} <span className="font-normal text-ink-muted">({new URL(link.url).hostname})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <h2 className="text-lg font-bold">Demander un devis</h2>
            {pro.accepts_quotes ? (
              <QuoteForm businessId={pro.id} back={back} services={pro.services} />
            ) : (
              <p className="text-sm text-ink-muted">Ce professionnel ne reçoit pas de demandes de devis en ligne.</p>
            )}
            <ReportForm target={{ professionnel: pro.id }} back={back} label="Signaler cette fiche" />
          </div>
          {!extras.isClaimed && (
            <details className="rounded-card border border-border bg-surface p-4">
              <summary className="cursor-pointer font-semibold">C’est votre activité ? Revendiquer la page</summary>
              <div className="mt-3">
                <ClaimForm businessId={pro.id} back={back} />
              </div>
            </details>
          )}
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
