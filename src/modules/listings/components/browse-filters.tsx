import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { href } from "@/config/routes";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select } from "@/components/ui/form-controls";
import type { CitySummary } from "@/domain/city";
import type { Category } from "@/server/repositories/categories";
import type { AttributeDefinition } from "../domain/attributes";
import { BROWSE_SORTS, type BrowseParams } from "../domain/browse";

/** Arborescence aplatie (ordre d'affichage) avec la profondeur de chaque catégorie. */
function flatTree(categories: readonly Category[], parentId: string | null = null, depth = 0): { category: Category; depth: number }[] {
  return categories
    .filter((category) => category.parent_id === parentId)
    .flatMap((category) => [{ category, depth }, ...flatTree(categories, category.id, depth + 1)]);
}

function AttributeFilter({ name, definition, value, min, max }: { name: string; definition: AttributeDefinition; value?: string; min?: string; max?: string }) {
  const { type } = definition;
  if (type.kind === "choice") {
    return (
      <Field label={definition.label}>
        {(props) => (
          <Select {...props} name={name} defaultValue={value ?? ""}>
            <option value="">Indifférent</option>
            {Object.entries(type.options).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    );
  }
  if (type.kind === "boolean") return <Checkbox name={name} value="1" defaultChecked={value === "1"} label={definition.label} />;
  if (type.kind === "integer") {
    const unit = type.unit ? ` (${type.unit})` : "";
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">
          {definition.label}
          {unit}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Field label={<span className="font-normal">Minimum</span>}>
            {(props) => <Input {...props} name={`${name}_min`} inputMode="numeric" pattern="[0-9 .]*" defaultValue={min ?? ""} />}
          </Field>
          <Field label={<span className="font-normal">Maximum</span>}>
            {(props) => <Input {...props} name={`${name}_max`} inputMode="numeric" pattern="[0-9 .]*" defaultValue={max ?? ""} />}
          </Field>
        </div>
      </fieldset>
    );
  }
  return <Field label={definition.label}>{(props) => <Input {...props} name={name} maxLength={60} defaultValue={value ?? ""} />}</Field>;
}

/**
 * Filtres de « Toutes les annonces » : les caractéristiques proposées sont
 * celles de la catégorie choisie (aucun kilométrage pour un meuble). Repliés sur mobile.
 */
export function BrowseFilters({
  params,
  categories,
  cities,
  neighborhoods,
  filters,
}: {
  params: BrowseParams;
  categories: readonly Category[];
  cities: readonly CitySummary[];
  neighborhoods: readonly { slug: string; name: string }[];
  filters: readonly [string, AttributeDefinition][];
}) {
  return (
    <details className="rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres et tri
      </summary>
      <Form action={href("listings")} className="flex flex-col gap-4 border-t border-border p-4 lg:border-0 lg:p-0">
        <h2 className="hidden text-lg font-bold lg:block">Filtres et tri</h2>
        {params.q && <input type="hidden" name="q" value={params.q} />}
        <Field label="Trier par">
          {(props) => (
            <Select {...props} name="tri" defaultValue={params.tri ?? (params.q ? "pertinence" : "recent")}>
              {Object.entries(BROWSE_SORTS)
                .filter(([value]) => value !== "pertinence" || params.q)
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Rubrique" hint="Les filtres propres à la rubrique apparaissent après « Appliquer ».">
          {(props) => (
            <Select {...props} name="categorie" defaultValue={params.categorie ?? ""}>
              <option value="">Toutes les rubriques</option>
              {flatTree(categories).map(({ category, depth }) => (
                <option key={category.id} value={category.slug}>
                  {`${"  ".repeat(depth)}${depth ? "› " : ""}${category.name}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {cities.length > 1 && (
          <Field label="Ville">
            {(props) => (
              <Select {...props} name="ville" defaultValue={params.ville ?? ""}>
                <option value="">Toutes les villes</option>
                {cities.map((city) => (
                  <option key={city.slug} value={city.slug}>
                    {city.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {neighborhoods.length > 0 && (
          <Field label="Quartier" hint="Noms des quartiers en cours de validation locale.">
            {(props) => (
              <Select {...props} name="quartier" defaultValue={params.quartier ?? ""}>
                <option value="">Toute la ville</option>
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood.slug} value={neighborhood.slug}>
                    {neighborhood.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Prix déclaré (FCFA)</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label={<span className="font-normal">Minimum</span>}>
              {(props) => <Input {...props} name="prix_min" inputMode="numeric" pattern="[0-9 .]*" defaultValue={params.prixMin ?? ""} />}
            </Field>
            <Field label={<span className="font-normal">Maximum</span>}>
              {(props) => <Input {...props} name="prix_max" inputMode="numeric" pattern="[0-9 .]*" defaultValue={params.prixMax ?? ""} />}
            </Field>
          </div>
        </fieldset>
        {filters.map(([key, definition]) => (
          <AttributeFilter
            key={key}
            name={key}
            definition={definition}
            value={params.attributes[key]}
            min={params.attributes[`${key}_min`]}
            max={params.attributes[`${key}_max`]}
          />
        ))}
        <Checkbox name="dispo" value="1" defaultChecked={params.dispo} label="Disponibles uniquement" description="Disponibilité déclarée par l’annonceur." />
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Appliquer
        </button>
      </Form>
    </details>
  );
}
