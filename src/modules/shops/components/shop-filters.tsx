import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { href } from "@/config/routes";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Select } from "@/components/ui/form-controls";
import { BUDGET_LEVELS, SHOP_AMBIANCES, SHOP_FEATURES } from "../domain/attributes";
import type { ShopFilters } from "../domain/params";

const RADII = [1, 5, 10, 25];

/** Filtres de l'annuaire (GET, sans JavaScript), repliés sur mobile. La distance exige une position autorisée. */
export function ShopFiltersForm({
  filters,
  neighborhoods,
  hasPosition,
  showAmbiance,
}: {
  filters: ShopFilters;
  neighborhoods: { slug: string; name: string }[];
  hasPosition: boolean;
  showAmbiance: boolean;
}) {
  return (
    <details className="rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres et tri
      </summary>
      <Form action={href("shops")} className="flex flex-col gap-4 border-t border-border p-4 lg:border-0 lg:p-0" aria-label="Filtres des commerces">
        <h2 className="hidden text-lg font-bold lg:block">Filtres et tri</h2>
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
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
        <Field label="Budget indicatif" hint="Ordre de grandeur relevé par l’équipe, jamais un prix.">
          {(props) => (
            <Select {...props} name="budget" defaultValue={filters.budget ? String(filters.budget) : ""}>
              <option value="">Tous budgets</option>
              {Object.entries(BUDGET_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {value === "4" ? label : `Jusqu’à « ${label.toLowerCase()} »`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Services</legend>
          {Object.entries(SHOP_FEATURES).map(([value, label]) => (
            <Checkbox key={value} name="services" value={value} defaultChecked={filters.services.includes(value as never)} label={label} />
          ))}
        </fieldset>
        {showAmbiance && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Ambiance</legend>
            {Object.entries(SHOP_AMBIANCES).map(([value, label]) => (
              <Checkbox key={value} name="ambiance" value={value} defaultChecked={filters.ambiance.includes(value as never)} label={label} />
            ))}
          </fieldset>
        )}
        <Field label="Distance" hint={hasPosition ? undefined : "Autorisez votre position (page Recherche) pour filtrer par distance."}>
          {(props) => (
            <Select {...props} name="rayon" defaultValue={filters.rayon ? String(filters.rayon) : ""} disabled={!hasPosition}>
              <option value="">Sans limite</option>
              {RADII.map((km) => (
                <option key={km} value={km}>
                  Moins de {km} km
                </option>
              ))}
            </Select>
          )}
        </Field>
        {hasPosition && <Checkbox name="tri" value="proximite" defaultChecked={filters.tri === "proximite"} label="Trier par distance" />}
        <Checkbox name="verifie" value="1" defaultChecked={filters.verifie} label="Informations vérifiées uniquement" />
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Appliquer
        </button>
      </Form>
    </details>
  );
}
