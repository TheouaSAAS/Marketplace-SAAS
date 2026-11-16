import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, LocateFixed, Map as MapIcon } from "lucide-react";
import { href } from "@/config/routes";
import { LAUNCH_CITY } from "@/domain/city";
import { publicEnv } from "@/lib/env";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { MapPreview } from "@/modules/map/components/map-preview";
import { ALL_LAYERS, MAP_LAYERS } from "@/modules/map/domain/layers";
import { mapQuery, parseMapFilters } from "@/modules/map/domain/params";
import { loadMapPage } from "@/modules/map/server/page-data";
import { isFeatureEnabled } from "@/server/features";

/**
 * Section « Explorer sur la carte » de l'accueil : aperçu des positions
 * publiques, légende chiffrée par couche (chaque couche ouvre la carte filtrée)
 * et accès à la carte complète. Absente si la carte est coupée, indisponible
 * ou sans aucun point : l'accueil ne montre jamais une carte vide.
 */
export async function HomeMap() {
  // Drapeaux lus en direct : rendu à chaque requête, jamais figé au pré-rendu (sinon l'arbre repris diffère).
  await connection();
  if (!isFeatureEnabled("map")) return null;
  const data = await loadMapPage({});
  if (data.kind !== "ok" || data.features.length === 0) return null;

  const counts = ALL_LAYERS.map((layer) => ({ layer, count: data.features.filter((feature) => feature.layer === layer).length })).filter(
    (entry) => entry.count > 0,
  );
  const points = data.features.map((feature) => ({
    lat: feature.lat,
    lng: feature.lng,
    color: MAP_LAYERS[feature.layer].color,
    approximate: feature.location_precision !== "exact",
  }));

  return (
    <section aria-labelledby="carte-accueil" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="carte-accueil" className="text-2xl font-bold">
          Explorer {LAUNCH_CITY.name} sur la carte
        </h2>
        <Link href={href("map")} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          Ouvrir la carte <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <MapPreview
          points={points}
          tileUrl={publicEnv.NEXT_PUBLIC_MAP_TILE_URL}
          attribution={publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION}
          label={`Aperçu de la carte : ${data.total} élément${data.total > 1 ? "s" : ""} avec une position publique.`}
        />
        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-ink-muted">
            Logements, services, commerces, sorties et événements, avec leur position publique. Choisissez une couche :
          </p>
          <ul className="flex flex-col gap-1">
            {counts.map(({ layer, count }) => (
              <li key={layer}>
                <Link
                  href={`${href("map")}?${mapQuery(parseMapFilters({ couches: layer }))}`}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-control px-2 text-sm font-medium hover:bg-sand-100"
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="inline-block h-3 w-3 rounded-pill" style={{ background: MAP_LAYERS[layer].color }} />
                    {MAP_LAYERS[layer].label}
                  </span>
                  <span className="text-ink-muted">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2">
            <ButtonLink href={href("map")} icon={<MapIcon aria-hidden className="h-4 w-4" />}>
              Ouvrir la carte
            </ButtonLink>
            {isFeatureEnabled("geolocation") && (
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <LocateFixed aria-hidden className="h-3.5 w-3.5" />
                « Autour de moi » sur la carte, si vous l’autorisez.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeMapSkeleton() {
  return <Skeleton className="h-80 w-full rounded-card" />;
}
