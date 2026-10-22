import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { hasPage, href } from "@/config/routes";
import { displayedVerification } from "@/domain/verification";
import { publicEnv } from "@/lib/env";
import { Checkbox } from "@/components/ui/choice-controls";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MapExplorer, type MapItem } from "@/modules/map/components/map-explorer";
import { MAP_LAYERS, UNAVAILABLE_LAYERS, type MapFeature } from "@/modules/map/domain/layers";
import { mapQuery, type MapFilters } from "@/modules/map/domain/params";
import { loadMapPage, MAP_LIMIT } from "@/modules/map/server/page-data";
import { PositionControl } from "@/modules/search/components/position-control";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = {
  title: "Carte interactive de San Pedro",
  description: "Logements, services, commerces, lieux touristiques et événements sur la carte, synchronisés avec la liste. Positions publiques uniquement.",
};

type Raw = Record<string, string | string[] | undefined>;

/** Lien vers la fiche de chaque type d'élément (rien si la page n'existe pas encore). */
function detailHref(feature: MapFeature): string | null {
  switch (feature.layer) {
    case "immobilier":
    case "emploi":
      return href("listingDetail", { params: { slug: feature.slug } });
    case "services":
      return href("professionalDetail", { params: { slug: feature.slug } });
    case "commerces":
    case "tourisme":
      return href("placeDetail", { params: { slug: feature.slug } });
    case "evenements":
      return hasPage("eventDetail") ? href("eventDetail", { params: { slug: feature.slug } }) : null;
  }
}

function MapFiltersForm({ filters, neighborhoods }: { filters: MapFilters; neighborhoods: { slug: string; name: string }[] }) {
  return (
    <Form action={href("map")} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-label="Couches et quartier">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Couches</legend>
        <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3 lg:grid-cols-2">
          {Object.entries(MAP_LAYERS).map(([key, layer]) => (
            <Checkbox
              key={key}
              name="couches"
              value={key}
              defaultChecked={filters.couches.includes(key as never)}
              label={
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-3 w-3 rounded-pill" style={{ background: layer.color }} />
                  {layer.label}
                </span>
              }
            />
          ))}
        </div>
        {UNAVAILABLE_LAYERS.map((layer) => (
          <p key={layer.key} className="text-xs text-ink-subtle">
            {layer.label} : {layer.reason}
          </p>
        ))}
      </fieldset>
      {neighborhoods.length > 0 && (
        <Field label="Quartier">
          {(props) => (
            <Select {...props} name="quartier" defaultValue={filters.quartier ?? ""}>
              <option value="">Toute la ville</option>
              {neighborhoods.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        Afficher
      </button>
    </Form>
  );
}

async function MapContent({ searchParams }: { searchParams: Promise<Raw> }) {
  const data = await loadMapPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("map")}?${data.query}` : href("map"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Carte indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="La carte est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  const items: MapItem[] = data.features.map((feature) => ({
    ...feature,
    href: detailHref(feature),
    shownStatus: displayedVerification(feature.verification_status, feature.verified_at, now),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <MapFiltersForm key={mapQuery(data.filters)} filters={data.filters} neighborhoods={data.neighborhoods} />
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          {isFeatureEnabled("geolocation") && <PositionControl hasPosition={data.position !== null} />}
          <p className="text-sm" role="status">
            {data.total === 0
              ? "Aucun élément avec une position publique pour ces critères."
              : data.total > MAP_LIMIT
                ? `${MAP_LIMIT} éléments affichés sur ${data.total} : zoomez puis « Rechercher dans cette zone », ou filtrez.`
                : `${data.total} élément${data.total > 1 ? "s" : ""}${data.neighborhood ? ` rattaché${data.total > 1 ? "s" : ""} au quartier ${data.neighborhood.name}` : ""}.`}
          </p>
          {data.filters.zone && (
            <Link href={`${href("map")}${mapQuery({ ...data.filters, zone: null }) ? `?${mapQuery({ ...data.filters, zone: null })}` : ""}`} className="text-sm font-medium underline">
              Effacer la zone
            </Link>
          )}
          {data.neighborhood && !data.boundary && (
            <p className="text-xs text-ink-muted">Ce quartier n’a pas de périmètre validé : la carte montre les éléments qui lui sont rattachés, sans tracer de limite.</p>
          )}
        </div>
      </div>
      <MapExplorer
        key={mapQuery(data.filters)}
        items={items}
        filters={data.filters}
        boundary={data.boundary}
        position={data.position}
        mapEnabled={isFeatureEnabled("map")}
        tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
        attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
      />
      <p className="text-xs text-ink-subtle">
        Positions publiques uniquement : les annonces dont l’auteur a choisi « quartier seulement » ou « masquée » n’apparaissent pas, et les positions
        approximatives (contour pointillé) sont arrondies à environ 500 m. L’itinéraire s’ouvre dans OpenStreetMap ; la plateforme ne fournit pas de
        navigation.
      </p>
    </div>
  );
}

export default function MapPage({ searchParams }: PageProps<"/carte">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Carte interactive" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Carte interactive</h1>
        <p className="max-w-2xl text-ink-muted">
          Explorer San Pedro par couche, par quartier ou autour de vous. La liste présente toujours les mêmes éléments que la carte.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[32rem] w-full rounded-card" />}>
        <MapContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
