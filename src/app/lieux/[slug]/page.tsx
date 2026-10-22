import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BadgeCheck, Clock, ExternalLink, MapPin, Navigation, Phone } from "lucide-react";
import { href } from "@/config/routes";
import { displayedVerification, isReliable } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ShareButton, WhatsAppShareLink } from "@/modules/listings/components/listing-buttons";
import { ListingMap } from "@/modules/listings/components/listing-map";
import { ReportForm } from "@/modules/listings/components/report-form";
import { contactLink } from "@/modules/listings/domain/presentation";
import { ambianceLabels, budgetLabel, featureLabels } from "@/modules/shops/domain/attributes";
import { hoursStatus, isOpenAt, parseOpeningHours, weekLines } from "@/modules/shops/domain/hours";
import { PracticalInfo, SourceAndVerification } from "@/modules/tourism/components/practical-info";
import { ClaimForm, PlaceFavoriteButton, PlaceLikeButton, PlaceMessageForm } from "@/modules/shops/components/place-actions";
import { getMyPendingClaim, getPlaceEngagement, getPlaceImages, getPlacePoint, getPublicPlace, type PlaceDetail } from "@/modules/shops/server/queries";
import { getSessionUser } from "@/server/auth";
import { isFeatureEnabled } from "@/server/features";

type Props = PageProps<"/lieux/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPublicPlace(slug);
  if (!place) return { title: "Lieu", robots: { index: false, follow: true } };
  return {
    title: place.name,
    description: (place.summary ?? place.description ?? "").slice(0, 160) || undefined,
    robots: place.verification_status === "placeholder" ? { index: false, follow: true } : undefined,
  };
}

function Hours({ place, now }: { place: PlaceDetail; now: Date }) {
  const hours = parseOpeningHours(place.opening_hours);
  const status = hoursStatus(hours, place.opening_hours_verified_at, place.hours_source?.title ?? null, now);
  return (
    <section aria-labelledby="horaires" className="flex flex-col gap-2">
      <h2 id="horaires" className="flex items-center gap-2 text-xl font-bold">
        <Clock aria-hidden className="h-5 w-5 text-brand-700" />
        Horaires
      </h2>
      {status.kind === "missing" ? (
        <p className="text-sm text-ink-muted">Horaires non renseignés : renseignez-vous auprès du commerce avant de vous déplacer.</p>
      ) : (
        <>
          {status.kind === "verified" ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-success">
              <BadgeCheck aria-hidden className="h-4 w-4" />
              Vérifiés le {formatDate(status.verifiedAt)}
              {status.source ? ` · source : ${status.source}` : ""}
            </p>
          ) : (
            <Alert tone="warning" title="Horaires à confirmer">
              {status.reason === "expired"
                ? "Leur vérification date de plus de 6 mois : ils ont pu changer."
                : "Ils n’ont pas été vérifiés par l’équipe locale : confirmez-les avant de vous déplacer."}
            </Alert>
          )}
          {hours && (
            <p className="text-sm font-semibold">
              {isOpenAt(hours, now) ? "Ouvert maintenant" : "Fermé maintenant"}
              <span className="font-normal text-ink-muted">
                {status.kind === "verified" ? " d’après les horaires vérifiés" : " d’après des horaires à confirmer"}
              </span>
            </p>
          )}
          {hours && (
            <dl className="grid max-w-sm grid-cols-[7rem_minmax(0,1fr)] gap-y-1 text-sm">
              {weekLines(hours).map((line) => (
                <div key={line.day} className="contents">
                  <dt className="text-ink-muted">{line.label}</dt>
                  <dd>{line.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </section>
  );
}

async function Location({ place }: { place: PlaceDetail }) {
  const point = await getPlacePoint(place.id);
  const area = [place.neighborhood?.name, place.city?.name].filter(Boolean).join(", ");
  const exact = point?.location_precision === "exact";
  return (
    <section aria-labelledby="localisation" className="flex flex-col gap-3">
      <h2 id="localisation" className="text-xl font-bold">
        Localisation
      </h2>
      <p className="flex items-center gap-1.5 font-semibold">
        <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
        {place.address_text ?? area}
      </p>
      {point ? (
        <>
          {isFeatureEnabled("map") && (
            <ListingMap
              lat={point.lat}
              lng={point.lng}
              radiusMeters={exact ? null : 400}
              tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
              attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
              label={`Carte : ${exact ? "emplacement" : "zone approximative"}, ${area}`}
            />
          )}
          {exact ? (
            <a
              href={`https://www.openstreetmap.org/directions?to=${point.lat}%2C${point.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill border border-border-strong px-4 text-sm font-semibold hover:bg-sand-100"
            >
              <Navigation aria-hidden className="h-4 w-4" />
              Itinéraire (OpenStreetMap)
            </a>
          ) : (
            <p className="text-sm text-ink-muted">Position approximative (zone d’environ 500 m) : itinéraire précis indisponible.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-muted">Position non renseignée.</p>
      )}
    </section>
  );
}

async function Engagement({ place, back }: { place: PlaceDetail; back: string }) {
  const engagement = await getPlaceEngagement(place.id);
  const url = `${publicEnv.NEXT_PUBLIC_SITE_URL}${back}`;
  return (
    <div className="flex flex-wrap gap-2">
      <PlaceFavoriteButton placeId={place.id} active={engagement.favorite} back={back} />
      <PlaceLikeButton placeId={place.id} liked={engagement.liked} count={engagement.likes} back={back} />
      <ShareButton url={url} title={place.name} />
      <WhatsAppShareLink url={url} title={place.name} />
    </div>
  );
}

async function Contact({ place, back, now }: { place: PlaceDetail; back: string; now: Date }) {
  const contactReliable = isReliable(place.verification_status, place.verified_at, now, "contact");
  const channels = [
    place.phone ? { label: "Téléphone", value: place.phone, link: contactLink("phone", place.phone) } : null,
    place.whatsapp ? { label: "WhatsApp", value: place.whatsapp, link: contactLink("whatsapp", place.whatsapp) } : null,
    place.website ? { label: "Site web", value: place.website.replace(/^https?:\/\//, ""), link: place.website } : null,
  ].filter((channel) => channel !== null);
  return (
    <section aria-labelledby="contact" className="flex flex-col gap-3">
      <h2 id="contact" className="text-lg font-bold">
        Contacter
      </h2>
      {channels.length > 0 && (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {channels.map((channel) => (
              <li key={channel.label} className="flex items-center gap-1.5">
                {channel.label === "Site web" ? <ExternalLink aria-hidden className="h-4 w-4" /> : <Phone aria-hidden className="h-4 w-4" />}
                {channel.label} :{" "}
                <a className="font-medium underline" href={channel.link} {...(channel.label === "Site web" ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {channel.value}
                </a>
              </li>
            ))}
          </ul>
          {!contactReliable && <p className="text-xs text-ink-muted">Coordonnées non vérifiées récemment par l’équipe locale : à confirmer.</p>}
        </>
      )}
      {place.manager_id ? (
        <PlaceMessageForm placeId={place.id} back={back} />
      ) : (
        <p className="text-sm text-ink-muted">
          {channels.length === 0 ? "Aucune coordonnée renseignée pour l’instant. " : ""}
          {place.kind === "etablissement"
            ? "La messagerie sera disponible quand l’exploitant aura revendiqué cette vitrine."
            : "Site sans exploitant : renseignez-vous sur place ou auprès d’un opérateur (« Que découvrir ? »)."}
        </p>
      )}
    </section>
  );
}

async function Claim({ place, back }: { place: PlaceDetail; back: string }) {
  const user = await getSessionUser();
  const pending = user ? await getMyPendingClaim(place.id, user.id) : null;
  return (
    <details className="rounded-card border border-border bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Vous êtes l’exploitant ? Revendiquer cette vitrine</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-ink-muted">
          Après vérification par l’équipe locale, vous recevrez les messages des clients et pourrez faire corriger la fiche. La revendication est
          gratuite et ne change ni l’ordre des résultats ni le statut de vérification.
        </p>
        {pending ? (
          <Alert tone="info" title="Demande en cours d’examen">
            Envoyée le {formatDate(pending.created_at)}. Vous serez notifié de la décision.
          </Alert>
        ) : (
          <ClaimForm placeId={place.id} back={back} />
        )}
      </div>
    </details>
  );
}

async function Place({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const place = await getPublicPlace(slug);
  if (!place) notFound();
  // Vérification, horaires et ouverture jugés à la date de la requête.
  await connection();
  const now = new Date();
  const back = href("placeDetail", { params: { slug } });
  const images = await getPlaceImages(place.id);
  const isShop = place.kind === "etablissement";
  const features = featureLabels(place.features);
  const ambiance = ambianceLabels(place.ambiance);
  const budget = budgetLabel(place.price_level);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[isShop ? { label: "Commerces de proximité", href: href("shops") } : { label: "Découvrir et sortir", href: href("discover") }, { label: place.name }]}
      />
      {place.verification_status === "placeholder" && (
        <Alert tone="warning" title="Exemple de démonstration">
          Cette vitrine est fictive et sert à tester la plateforme : ne vous y fiez pas.
        </Alert>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <VerificationBadge status={displayedVerification(place.verification_status, place.verified_at, now)} />
              {place.manager_id && <Badge tone="brand">Gérée par l’exploitant</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{place.name}</h1>
            <p className="text-ink-muted">{[place.category?.name, place.neighborhood?.name, place.city?.name].filter(Boolean).join(" · ")}</p>
            {budget && <p className="text-sm font-medium">{budget}</p>}
          </div>
          <Suspense fallback={<Skeleton className="h-11 w-72" />}>
            <Engagement place={place} back={back} />
          </Suspense>
          {(place.description ?? place.summary) && <p className="whitespace-pre-line">{place.description ?? place.summary}</p>}

          <section aria-labelledby="galerie" className="flex flex-col gap-2">
            <h2 id="galerie" className="text-xl font-bold">
              Galerie
            </h2>
            {images.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((image) => (
                  <li key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-control bg-sand-100">
                    <Image src={image.url} alt={image.alt} fill sizes="(min-width: 640px) 33vw, 50vw" className="object-cover" unoptimized />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">Aucune photo pour l’instant.</p>
            )}
          </section>

          {(features.length > 0 || ambiance.length > 0 || place.products.length > 0) && (
            <section aria-labelledby="offre" className="flex flex-col gap-3">
              <h2 id="offre" className="text-xl font-bold">
                Services et produits
              </h2>
              {features.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Services">
                  {features.map((label) => (
                    <li key={label}>
                      <Badge tone="neutral">{label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {ambiance.length > 0 && <p className="text-sm">Ambiance : {ambiance.join(", ").toLowerCase()}</p>}
              {place.products.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 pl-5" aria-label="Produits">
                  {place.products.map((product) => (
                    <li key={product}>{product}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-subtle">Informations déclarées, sans garantie de stock ni de prix.</p>
            </section>
          )}

          {place.category?.family === "decouvrir" && <PracticalInfo place={place} />}
          <Hours place={place} now={now} />
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <Location place={place} />
          </Suspense>
          <SourceAndVerification status={place.verification_status} verifiedAt={place.verified_at} source={place.source?.title ?? null} now={now} />
          <p className="text-xs text-ink-subtle">Fiche mise à jour le {formatDate(place.updated_at)}.</p>
        </div>
        <aside className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4" aria-label="Contacter">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <Contact place={place} back={back} now={now} />
          </Suspense>
          <ReportForm target={{ lieu: place.id }} back={back} label="Signaler cette vitrine" />
        </aside>
      </div>
      {isShop && !place.manager_id && (
        <Suspense fallback={null}>
          <Claim place={place} back={back} />
        </Suspense>
      )}
    </div>
  );
}

export default function PlacePage({ params }: Props) {
  return (
    <Container className="py-6 sm:py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Place params={params} />
      </Suspense>
    </Container>
  );
}
