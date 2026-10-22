"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Navigation, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { VerificationStatus } from "@/domain/verification";
import { LAUNCH_CITY } from "@/domain/city";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/verification";
import { distanceKm } from "@/modules/tourism/domain/itinerary";
import { clusterPoints } from "../domain/cluster";
import { directionsHref, MAP_LAYERS, type MapFeature } from "../domain/layers";
import { mapQuery, type MapFilters, type MapZone } from "../domain/params";

export type MapItem = MapFeature & { href: string | null; shownStatus: VerificationStatus };

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

function distanceLabel(km: number): string {
  return km < 1 ? `à environ ${Math.max(100, Math.round(km * 10) * 100)} m` : `à environ ${km.toFixed(1).replace(".", ",")} km`;
}

/** Fiche rapide de l'élément choisi (carte ou liste). */
function QuickCard({ item, onClose }: { item: MapItem; onClose: () => void }) {
  const directions = directionsHref(item);
  return (
    <section aria-label={`Fiche rapide : ${item.title}`} className="flex flex-col gap-2 rounded-card border border-brand-300 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral">{MAP_LAYERS[item.layer].label}</Badge>
          <VerificationBadge status={item.shownStatus} />
        </div>
        <button type="button" onClick={onClose} className="min-h-9 rounded-control px-2 text-sm text-ink-muted hover:bg-sand-100">
          Fermer
        </button>
      </div>
      <h3 className="font-bold">{item.title}</h3>
      <p className="text-sm text-ink-muted">{[item.category, item.neighborhood, item.starts_at ? DATE.format(new Date(item.starts_at)) : null].filter(Boolean).join(" · ")}</p>
      <p className="text-xs text-ink-subtle">
        {item.location_precision === "exact" ? "Emplacement indiqué par la fiche." : "Position approximative (zone d’environ 500 m) : l’adresse se précise auprès de l’auteur."}
      </p>
      <div className="flex flex-wrap gap-2">
        {item.href && (
          <Link href={item.href} className="inline-flex min-h-11 items-center gap-1 rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            <ExternalLink aria-hidden className="h-4 w-4" />
            Voir la fiche
          </Link>
        )}
        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 rounded-pill border border-border-strong px-4 text-sm font-semibold hover:bg-sand-100"
          >
            <Navigation aria-hidden className="h-4 w-4" />
            Itinéraire (OpenStreetMap)
          </a>
        )}
      </div>
    </section>
  );
}

/**
 * Carte et liste synchronisées : un clic sur un marqueur choisit l'élément
 * dans la liste, un clic dans la liste le montre sur la carte. Les marqueurs
 * proches sont regroupés ; la carte ne recharge rien d'elle-même : « Rechercher
 * dans cette zone » met la zone dans l'adresse (une requête par demande).
 */
export function MapExplorer({
  items,
  filters,
  boundary,
  position,
  mapEnabled,
  tileUrl,
  attribution,
}: {
  items: MapItem[];
  filters: MapFilters;
  boundary: string | null;
  position: { lat: number; lng: number } | null;
  mapEnabled: boolean;
  tileUrl: string;
  attribution: string;
}) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [moved, setMoved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Liste triée par distance quand la position (arrondie) est connue.
  const sorted = useMemo(() => {
    if (!position) return items.map((item) => ({ item, km: null as number | null }));
    return items.map((item) => ({ item, km: distanceKm(position, item) })).sort((a, b) => a.km - b.km);
  }, [items, position]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  // Carte : créée une fois, chargée seulement dans le navigateur.
  useEffect(() => {
    if (!mapEnabled) return;
    let disposed = false;
    import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        leafletRef.current = L;
        const map = L.map(container.current, { scrollWheelZoom: false });
        mapRef.current = map;
        L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
        markersRef.current = L.layerGroup().addTo(map);
        if (filters.zone) {
          map.fitBounds([
            [filters.zone.south, filters.zone.west],
            [filters.zone.north, filters.zone.east],
          ]);
        } else if (boundary) {
          const outline = L.geoJSON(JSON.parse(boundary) as GeoJSON.GeoJsonObject, { style: { color: "#0f5c73", weight: 2, fillOpacity: 0.05 } }).addTo(map);
          map.fitBounds(outline.getBounds(), { padding: [16, 16] });
        } else if (items.length > 0) {
          map.fitBounds(L.latLngBounds(items.map((item) => [item.lat, item.lng] as [number, number])), { padding: [32, 32], maxZoom: 15 });
        } else {
          map.setView([LAUNCH_CITY.center.lat, LAUNCH_CITY.center.lng], LAUNCH_CITY.defaultZoom);
        }
        if (boundary && filters.zone) L.geoJSON(JSON.parse(boundary) as GeoJSON.GeoJsonObject, { style: { color: "#0f5c73", weight: 2, fillOpacity: 0.05 } }).addTo(map);
        if (position) L.circleMarker([position.lat, position.lng], { radius: 7, color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.9 }).bindTooltip("Votre position (arrondie)").addTo(map);
        setZoom(map.getZoom());
        // Les déplacements faits par la personne proposent une nouvelle recherche.
        map.on("dragend", () => setMoved(true));
        map.on("zoomend", () => {
          setZoom(map.getZoom());
          setMoved(true);
        });
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // La carte n'est recréée que si son fond change ; les éléments sont redessinés à part.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEnabled, tileUrl, attribution]);

  // Marqueurs (regroupés selon le zoom), redessinés quand la sélection ou le zoom change.
  useEffect(() => {
    const L = leafletRef.current;
    const group = markersRef.current;
    const map = mapRef.current;
    if (!ready || !L || !group || !map) return;
    group.clearLayers();
    const byId = new Map(items.map((item) => [item.id, item]));
    for (const cluster of clusterPoints(items, zoom)) {
      if (cluster.ids.length > 1 && !cluster.ids.includes(selectedId ?? "")) {
        L.marker([cluster.lat, cluster.lng], {
          icon: L.divIcon({
            className: "",
            html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:#0f5c73;color:#fff;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${cluster.ids.length}</span>`,
            iconSize: [36, 36],
          }),
          keyboard: true,
          title: `${cluster.ids.length} éléments : zoomer`,
        })
          .on("click", () => map.setView([cluster.lat, cluster.lng], Math.min(map.getZoom() + 2, 19)))
          .addTo(group);
        continue;
      }
      for (const id of cluster.ids) {
        const item = byId.get(id)!;
        const color = MAP_LAYERS[item.layer].color;
        const active = item.id === selectedId;
        L.circleMarker([item.lat, item.lng], {
          radius: active ? 11 : 7,
          color: active ? "#111827" : color,
          weight: active ? 3 : 2,
          dashArray: item.location_precision === "exact" ? undefined : "3 3",
          fillColor: color,
          fillOpacity: 0.8,
        })
          .bindTooltip(item.title)
          .on("click", () => setSelectedId(item.id))
          .addTo(group);
      }
    }
  }, [ready, items, zoom, selectedId]);

  // Sélection depuis la liste : la carte se centre ; depuis la carte : la liste défile.
  const choose = (item: MapItem) => {
    setSelectedId(item.id);
    mapRef.current?.setView([item.lat, item.lng], Math.max(mapRef.current.getZoom(), 16));
  };
  useEffect(() => {
    if (!selectedId) return;
    listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const searchHere = () => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    // Arrondi identique à la forme canonique de l'adresse (4 décimales) : pas de redirection.
    const round = (value: number) => Math.round(value * 10_000) / 10_000;
    const zone: MapZone = { west: round(bounds.getWest()), south: round(bounds.getSouth()), east: round(bounds.getEast()), north: round(bounds.getNorth()) };
    const query = mapQuery({ ...filters, quartier: null, zone });
    setMoved(false);
    router.push(`?${query}`, { scroll: false });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="flex flex-col gap-2">
        {mapEnabled && !failed ? (
          <div className="relative">
            <div
              ref={container}
              role="region"
              aria-label="Carte des résultats (la liste à côté contient les mêmes éléments)"
              className="relative z-0 h-80 w-full overflow-hidden rounded-card border border-border bg-sand-100 sm:h-[32rem]"
            >
              {!ready && <p className="p-4 text-sm text-ink-muted">Chargement de la carte…</p>}
            </div>
            {moved && (
              <div className="absolute inset-x-0 top-3 z-[500] flex justify-center">
                <Button type="button" size="sm" onClick={searchHere} icon={<Search aria-hidden className="h-4 w-4" />}>
                  Rechercher dans cette zone
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-card border border-border bg-surface p-4 text-sm text-ink-muted">
            Carte indisponible pour le moment : la liste ci-contre présente les mêmes éléments, avec leur quartier et un lien vers leur fiche.
          </p>
        )}
        {selected && <QuickCard item={selected} onClose={() => setSelectedId(null)} />}
      </div>
      <ul ref={listRef} aria-label="Résultats de la carte" className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
        {sorted.map(({ item, km }) => (
          <li key={item.id} data-id={item.id}>
            <button
              type="button"
              onClick={() => choose(item)}
              aria-pressed={item.id === selectedId}
              className={cn(
                "flex w-full flex-col gap-1 rounded-card border bg-surface p-3 text-left hover:border-brand-300",
                item.id === selectedId ? "border-brand-600 ring-2 ring-brand-500/25" : "border-border",
              )}
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-pill" style={{ background: MAP_LAYERS[item.layer].color }} />
                {MAP_LAYERS[item.layer].label}
                {km !== null && <span className="font-normal">· {distanceLabel(km)}</span>}
              </span>
              <span className="font-semibold">{item.title}</span>
              <span className="text-xs text-ink-muted">{[item.category, item.neighborhood].filter(Boolean).join(" · ")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
