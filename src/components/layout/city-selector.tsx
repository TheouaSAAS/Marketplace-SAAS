"use client";

import { useTransition } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CitySummary } from "@/domain/city";
import { selectCity } from "@/server/actions/city";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

const CHIP =
  "inline-flex h-11 items-center gap-1.5 rounded-pill border border-border bg-surface px-3 text-sm font-semibold text-ink";

/**
 * Sélecteur de ville (choix manuel, toujours disponible, indépendant de la
 * géolocalisation). Une seule ville active : simple indication non interactive.
 */
export function CitySelector({
  cities,
  currentSlug,
  className,
}: {
  cities: CitySummary[];
  currentSlug: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const current = cities.find((city) => city.slug === currentSlug) ?? cities[0];

  if (cities.length <= 1) {
    return (
      <span className={cn(CHIP, className)} title="D’autres villes de Côte d’Ivoire ouvriront progressivement.">
        <MapPin aria-hidden className="h-4 w-4 text-brand-600" />
        <span className="sr-only">Ville : </span>
        {current?.name}
      </span>
    );
  }

  return (
    <label className={cn(CHIP, "relative cursor-pointer pr-2 hover:bg-sand-100", className)}>
      {pending ? <Spinner size="sm" label="Changement de ville" /> : <MapPin aria-hidden className="h-4 w-4 text-brand-600" />}
      <span className="sr-only">Choisir la ville</span>
      <select
        value={currentSlug}
        disabled={pending}
        onChange={(event) => {
          const slug = event.target.value;
          startTransition(async () => {
            const result = await selectCity(slug);
            if (!result.ok) notify({ tone: "danger", title: result.error.message });
          });
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-sm font-semibold focus:outline-none"
      >
        {cities.map((city) => (
          <option key={city.slug} value={city.slug}>
            {city.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CitySelectorFallback({ className }: { className?: string }) {
  return (
    <span className={cn(CHIP, "text-ink-subtle", className)} aria-hidden="true">
      <MapPin className="h-4 w-4" />
      <span className="h-3 w-16 animate-pulse rounded bg-sand-200" />
    </span>
  );
}
