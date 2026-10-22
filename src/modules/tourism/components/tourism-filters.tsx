import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Select } from "@/components/ui/form-controls";
import type { Category } from "@/server/repositories/categories";
import { BUDGET_LEVELS } from "@/modules/shops/domain/attributes";
import { ACCESSIBILITY, AUDIENCES, THEMES, VISIT_DURATIONS } from "../domain/attributes";
import type { TourismFilters } from "../domain/params";

const RADII = [5, 25, 50, 100];

function Choices({ legend, name, table, selected }: { legend: string; name: string; table: Record<string, string>; selected: readonly string[] }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-semibold">{legend}</legend>
      {Object.entries(table).map(([value, label]) => (
        <Checkbox key={value} name={name} value={value} defaultChecked={selected.includes(value)} label={label} />
      ))}
    </fieldset>
  );
}

/** Filtres touristiques (GET, sans JavaScript), repliés sur mobile. La distance exige une position autorisée. */
export function TourismFiltersForm({
  action,
  filters,
  types,
  hasPosition,
}: {
  action: string;
  filters: TourismFilters;
  types: Category[];
  hasPosition: boolean;
}) {
  return (
    <details className="rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres et tri
      </summary>
      <Form action={action} className="flex flex-col gap-4 border-t border-border p-4 lg:border-0 lg:p-0" aria-label="Filtres des lieux">
        <h2 className="hidden text-lg font-bold lg:block">Filtres et tri</h2>
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {types.length > 1 && (
          <Field label="Type de lieu">
            {(props) => (
              <Select {...props} name="type" defaultValue={filters.type ?? ""}>
                <option value="">Tous</option>
                {types.map((type) => (
                  <option key={type.slug} value={type.slug}>
                    {type.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Choices legend="Thèmes" name="themes" table={THEMES} selected={filters.themes} />
        <Choices legend="Public" name="public" table={AUDIENCES} selected={filters.public} />
        <Field label="Durée de visite (au plus)">
          {(props) => (
            <Select {...props} name="duree" defaultValue={filters.duree ?? ""}>
              <option value="">Toutes durées</option>
              {Object.entries(VISIT_DURATIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Budget indicatif" hint="Ordre de grandeur relevé par l’équipe ; un budget inconnu est exclu.">
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
        <Choices legend="Accessibilité" name="acces" table={ACCESSIBILITY} selected={filters.acces} />
        <Field label="Distance" hint={hasPosition ? undefined : "Autorisez votre position (page Recherche) pour filtrer par distance."}>
          {(props) => (
            <Select {...props} name="rayon" defaultValue={filters.rayon ? String(filters.rayon) : ""} disabled={!hasPosition}>
              <option value="">Sans limite (environs compris)</option>
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
