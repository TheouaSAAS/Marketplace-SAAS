"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Scale, X } from "lucide-react";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";

/*
 * Sélection de biens à comparer (3 au plus), gardée dans ce navigateur
 * seulement. Partagée entre les cartes et la barre par un petit magasin
 * synchronisé (événement « storage » + événement local).
 */

const KEY = "cdp-comparer-v1";
export const MAX_COMPARE = 3;
const EVENT = "cdp-comparer";

type Item = { slug: string; title: string };

let cache: { raw: string | null; items: Item[] } = { raw: null, items: [] };

function read(): Item[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return [];
  }
  if (raw === cache.raw) return cache.items;
  let items: Item[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      items = parsed
        .filter((item): item is Item => typeof item?.slug === "string" && typeof item?.title === "string")
        .slice(0, MAX_COMPARE);
    }
  } catch {
    items = [];
  }
  cache = { raw, items };
  return items;
}

function write(items: Item[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible (navigation privée) : la comparaison reste possible par l'adresse.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

const EMPTY: Item[] = [];
function useSelection(): Item[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function CompareToggle({ slug, title }: { slug: string; title: string }) {
  const items = useSelection();
  const selected = items.some((item) => item.slug === slug);
  const full = !selected && items.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={full}
      title={full ? `${MAX_COMPARE} biens au plus` : undefined}
      onClick={() => write(selected ? items.filter((item) => item.slug !== slug) : [...items, { slug, title }])}
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-pill border px-3 text-xs font-semibold disabled:opacity-50",
        selected ? "border-brand-600 bg-brand-50 text-brand-800" : "border-border-strong bg-surface hover:bg-sand-100",
      )}
    >
      <Scale aria-hidden className="h-3.5 w-3.5" />
      {selected ? "À comparer" : "Comparer"}
    </button>
  );
}

/** Barre de comparaison : visible dès qu'un bien est sélectionné. */
export function CompareBar() {
  const items = useSelection();
  if (items.length === 0) return null;
  const target = href("realEstateCompare", { query: { annonces: items.map((item) => item.slug).join(",") } });
  return (
    <div
      role="region"
      aria-label="Biens à comparer"
      className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-[min(100%-2rem,40rem)] items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card lg:bottom-6"
    >
      <p className="flex-1 text-sm">
        <span className="font-semibold">{items.length}</span> / {MAX_COMPARE} biens sélectionnés
      </p>
      <button type="button" onClick={() => write([])} className="inline-flex h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-sand-100">
        <X aria-hidden className="h-4 w-4" />
        Vider
      </button>
      {items.length >= 2 ? (
        <Link href={target} className="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Comparer
        </Link>
      ) : (
        <span className="text-xs text-ink-muted">Choisissez au moins 2 biens</span>
      )}
    </div>
  );
}
