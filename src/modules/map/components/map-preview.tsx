"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface PreviewPoint {
  lat: number;
  lng: number;
  color: string;
  /** Position arrondie (environ 500 m) : contour pointillé, comme sur la carte complète. */
  approximate: boolean;
}

/**
 * Aperçu non interactif de la carte (accueil) : les points publics colorés par
 * couche, cadrés sur leur ensemble. Leaflet n'est chargé que lorsque l'aperçu
 * approche de l'écran ; aucune interaction (ni glisser, ni zoom) pour ne jamais
 * piéger le défilement de la page : l'exploration se fait sur la carte complète.
 */
export function MapPreview({ points, tileUrl, attribution, label }: { points: PreviewPoint[]; tileUrl: string; attribution: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;

    const draw = () =>
      import("leaflet").then((L) => {
        if (disposed || !container.current) return;
        map = L.map(container.current, {
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          boxZoom: false,
          keyboard: false,
          zoomControl: false,
          attributionControl: true,
        });
        L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
        for (const point of points) {
          L.circleMarker([point.lat, point.lng], {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: point.color,
            fillOpacity: 0.9,
            dashArray: point.approximate ? "3 3" : undefined,
            interactive: false,
          }).addTo(map);
        }
        const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
      });

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void draw();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      map?.remove();
    };
  }, [points, tileUrl, attribution]);

  return (
    <figure className="m-0">
      <div ref={container} className="relative z-0 h-64 w-full overflow-hidden rounded-card border border-border bg-sand-100 sm:h-80" />
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
