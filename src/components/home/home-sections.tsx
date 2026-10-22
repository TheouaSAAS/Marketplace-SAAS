import { connection } from "next/server";
import { CalendarDays, Compass, Package, Store } from "lucide-react";
import { href } from "@/config/routes";
import { RECOMMENDATION_RULES } from "@/domain/recommendation";
import { logger } from "@/lib/logger";
import { listUpcomingEvents } from "@/modules/events/server/queries";
import { listRecentListings } from "@/modules/listings/server/queries";
import { listPlacesByFamily } from "@/modules/places/server/queries";
import { getCityContext } from "@/server/city-context";
import { EventCard, ListingCard, PlaceCard } from "@/components/content/content-cards";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { HomeSection, SectionGrid, SectionUnavailable } from "./home-section";

type Settled<T> = { ok: true; value: T } | { ok: false };

async function settle<T>(promise: Promise<T>, label: string): Promise<Settled<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    logger.warn("Section de l'accueil indisponible", { module: "accueil", section: label, error });
    return { ok: false };
  }
}

/**
 * Sections alimentées par la base, pour la ville choisie. Lit le cookie de
 * ville et l'heure : rendu à la requête, derrière <Suspense>.
 */
export async function HomeSections() {
  await connection();
  const { current, source } = await getCityContext();
  const now = new Date();

  if (!current.id) {
    return (
      <Alert tone="info" title="Contenus bientôt disponibles">
        {source === "not_configured"
          ? "La base de contenus n’est pas encore connectée."
          : "Les contenus de la ville sont momentanément indisponibles. Réessayez dans quelques instants."}
      </Alert>
    );
  }

  const [listings, discover, professionals, events] = await Promise.all([
    settle(listRecentListings(current.id, 4), "annonces"),
    settle(listPlacesByFamily(current.id, "decouvrir", 4), "decouvrir"),
    settle(listPlacesByFamily(current.id, "trouver", 4), "professionnels"),
    settle(listUpcomingEvents(current.id, 4), "evenements"),
  ]);

  const shownStatuses = [
    ...(listings.ok ? listings.value.map((item) => item.verification_status) : []),
    ...(discover.ok ? discover.value.map((item) => item.verification_status) : []),
    ...(professionals.ok ? professionals.value.map((item) => item.verification_status) : []),
    ...(events.ok ? events.value.map((item) => item.verification_status) : []),
  ];

  return (
    <div className="flex flex-col gap-12">
      {shownStatuses.includes("placeholder") && (
        <Alert tone="warning" title="Phase de lancement : contenus de démonstration">
          Les éléments marqués « Exemple · à valider localement » sont fictifs et servent à présenter la plateforme. Ne vous
          y fiez pas : ils disparaîtront à mesure que les vrais contenus seront publiés et vérifiés.
        </Alert>
      )}

      <HomeSection id="annonces-recentes" title="Annonces récentes" route="listings" rule={RECOMMENDATION_RULES.listings}>
        {!listings.ok ? (
          <SectionUnavailable />
        ) : listings.value.length === 0 ? (
          <EmptyState
            icon={<Package aria-hidden className="h-6 w-6" />}
            title={`Aucune annonce publiée à ${current.name} pour l’instant`}
            description="Logement, emploi, véhicule, service : publiez la première, elle sera relue par la modération."
            action={<ButtonLink href={href("publish")} variant="accent">Publier une annonce</ButtonLink>}
          />
        ) : (
          <SectionGrid>
            {listings.value.map((listing, index) => (
              <ListingCard key={listing.id} listing={listing} now={now} index={index} href={href("listingDetail", { params: { slug: listing.slug } })} />
            ))}
          </SectionGrid>
        )}
      </HomeSection>

      <HomeSection id="decouvrir-la-ville" title={`Découvrir ${current.name}`} route="discover" rule={RECOMMENDATION_RULES.places}>
        {!discover.ok ? (
          <SectionUnavailable />
        ) : discover.value.length === 0 ? (
          <EmptyState
            icon={<Compass aria-hidden className="h-6 w-6" />}
            title="Les premiers lieux sont en cours de vérification"
            description="Plages, restaurants, hébergements, sorties : ils apparaîtront ici avec leur source et leur date de vérification."
            action={<ButtonLink href={href("guide")} variant="secondary">Consulter le guide pratique</ButtonLink>}
          />
        ) : (
          <SectionGrid>
            {discover.value.map((place, index) => (
              <PlaceCard key={place.id} place={place} now={now} index={index} />
            ))}
          </SectionGrid>
        )}
      </HomeSection>

      <HomeSection id="professionnels" title="Commerces et professionnels" route="services" rule={RECOMMENDATION_RULES.professionals}>
        {!professionals.ok ? (
          <SectionUnavailable />
        ) : professionals.value.length === 0 ? (
          <EmptyState
            icon={<Store aria-hidden className="h-6 w-6" />}
            title="Aucun commerce ni prestataire publié pour l’instant"
            description="Vous êtes commerçant, artisan ou prestataire ? Créez votre compte professionnel pour apparaître ici."
            action={<ButtonLink href={href("signup")} variant="secondary">Créer un compte professionnel</ButtonLink>}
          />
        ) : (
          <SectionGrid>
            {professionals.value.map((place, index) => (
              <PlaceCard key={place.id} place={place} now={now} index={index} />
            ))}
          </SectionGrid>
        )}
      </HomeSection>

      <HomeSection id="evenements-a-venir" title="Événements à venir" route="events" rule={RECOMMENDATION_RULES.events}>
        {!events.ok ? (
          <SectionUnavailable />
        ) : events.value.length === 0 ? (
          <EmptyState
            icon={<CalendarDays aria-hidden className="h-6 w-6" />}
            title="Aucun événement annoncé pour l’instant"
            description="Organisateur ? Annoncez votre événement : il sera publié après vérification."
            action={<ButtonLink href={href("events")} variant="secondary">Voir la rubrique Événements</ButtonLink>}
          />
        ) : (
          <SectionGrid>
            {events.value.map((event, index) => (
              <EventCard key={event.id} event={event} now={now} index={index} />
            ))}
          </SectionGrid>
        )}
      </HomeSection>
    </div>
  );
}

/** Remplaçant pendant le chargement : mêmes dimensions que les grilles, pas de saut de mise en page. */
export function HomeSectionsSkeleton() {
  return (
    <div className="flex flex-col gap-12" aria-busy="true" aria-label="Chargement des contenus">
      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (__, card) => (
              <Skeleton key={card} className="aspect-[4/5] w-full rounded-card" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
