"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Placement de l'annonce sur la carte : un clic pose (ou déplace) le repère,
 * qu'on peut aussi faire glisser. Chargée dans le navigateur seulement ; la
 * molette ne zoome pas (défilement préservé). La position saisie reste privée.
 */
export function LocationPicker({
  lat,
  lng,
  center,
  tileUrl,
  attribution,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  center: { lat: number; lng: number };
  tileUrl: string;
  attribution: string;
  onChange: (point: { lat: number; lng: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const initial = useRef({ lat, lng });

  useEffect(() => {
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      leaflet.current = L;
      const start = initial.current;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView(
        start.lat !== null && start.lng !== null ? [start.lat, start.lng] : [center.lat, center.lng],
        start.lat !== null ? 16 : 13,
      );
      L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(instance);
      instance.on("click", (event) => change.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
      map.current = instance;
      if (start.lat !== null && start.lng !== null) placeMarker(L, instance, start.lat, start.lng);
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [center.lat, center.lng, tileUrl, attribution]);

  function placeMarker(L: typeof import("leaflet"), instance: import("leaflet").Map, pointLat: number, pointLng: number) {
    if (marker.current) {
      marker.current.setLatLng([pointLat, pointLng]);
      return;
    }
    const icon = L.divIcon({
      className: "",
      html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#0f5c73;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    marker.current = L.marker([pointLat, pointLng], { draggable: true, icon, keyboard: true, title: "Position de l’annonce" }).addTo(instance);
    marker.current.on("dragend", () => {
      const position = marker.current!.getLatLng();
      change.current({ lat: position.lat, lng: position.lng });
    });
  }

  useEffect(() => {
    if (!leaflet.current || !map.current || lat === null || lng === null) return;
    placeMarker(leaflet.current, map.current, lat, lng);
  }, [lat, lng]);

  return (
    <div
      ref={container}
      role="application"
      aria-label="Carte : cliquez pour placer l’annonce"
      className="relative z-0 h-72 w-full overflow-hidden rounded-card border border-border sm:h-80"
    />
  );
}
