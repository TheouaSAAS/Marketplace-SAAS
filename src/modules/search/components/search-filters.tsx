import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { href } from "@/config/routes";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select } from "@/components/ui/form-controls";
import type { NeighborhoodSummary } from "@/modules/neighborhoods/server/queries";
import type { Category } from "@/server/repositories/categories";
import {
  hasFilter,
  SEARCH_TYPES,
  SELLERS,
  SORTS,
  SORTS_BY_TYPE,
  supportsPlaceFilters,
  WHEN,
  type SearchParams,
  type SearchSort,
} from "../domain/params";

/** Catégories applicables au type affiché, parents puis enfants (indentés). */
function categoryOptions(categories: Category[], contentType: string | null): { slug: string; label: string }[] {
  if (!contentType) return [];
  const applicable = categories.filter((category) => category.content_types.some((type) => type === contentType));
  const ids = new Set(applicable.map((category) => category.id));
  return applicable
    .filter((category) => !category.parent_id || !ids.has(category.parent_id))
    .flatMap((parent) => [
      { slug: parent.slug, label: parent.name },
      ...applicable.filter((child) => child.parent_id === parent.id).map((child) => ({ slug: child.slug, label: `— ${child.name}` })),
    ]);
}

/**
 * Filtres de la recherche : formulaire GET classique (adresse partageable,
 * fonctionne sans JavaScript). Seuls les filtres utiles au type affiché sont
 * proposés ; la distance n'est active qu'avec une position autorisée.
 */
export function SearchFilters({
  params,
  sort,
  categories,
  neighborhoods,
  radiiKm,
  hasPosition,
  activeCount,
}: {
  params: SearchParams;
  sort: SearchSort | null;
  categories: Category[];
  neighborhoods: NeighborhoodSummary[];
  radiiKm: number[];
  hasPosition: boolean;
  activeCount: number;
}) {
  const { type } = params;
  const options = categoryOptions(categories, type ? SEARCH_TYPES[type].contentType : null);
  const placeFilters = supportsPlaceFilters(type);

  return (
    // Replié sur mobile (les filtres actifs restent visibles en puces au-dessus des résultats),
    // toujours déplié sur grand écran.
    <details
      className="group rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres et tri
        {activeCount > 0 && <span className="rounded-pill bg-brand-600 px-2 text-xs text-white">{activeCount}</span>}
      </summary>
      <Form action={href("search")} className="flex flex-col gap-4 border-t border-border p-4 lg:border-0 lg:p-0" aria-label="Filtres de recherche">
        <h2 className="hidden text-lg font-bold lg:block">Filtres et tri</h2>
        {params.q && <input type="hidden" name="q" value={params.q} />}
        {type && <input type="hidden" name="type" value={type} />}
        {params.brut && <input type="hidden" name="brut" value="1" />}

        {type && (
          <Field label="Trier par">
            {(props) => (
              <Select {...props} name="tri" defaultValue={sort ?? ""}>
                {SORTS_BY_TYPE[type].map((option) => (
                  <option key={option} value={option} disabled={option === "proximite" && !hasPosition}>
                    {SORTS[option]}
                    {option === "proximite" && !hasPosition ? " (position requise)" : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {hasFilter(type, "categorie") && options.length > 0 && (
          <Field label="Catégorie">
            {(props) => (
              <Select {...props} name="categorie" defaultValue={params.categorie ?? ""}>
                <option value="">Toutes les catégories</option>
                {options.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {placeFilters && neighborhoods.length > 0 && (
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

        {placeFilters && (
          <Field label="Distance" hint={hasPosition ? undefined : "Autorisez votre position pour filtrer par distance."}>
            {(props) => (
              <Select {...props} name="rayon" defaultValue={params.rayon ? String(params.rayon) : ""} disabled={!hasPosition}>
                <option value="">Sans limite</option>
                {radiiKm.map((km) => (
                  <option key={km} value={km}>
                    Moins de {km} km
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {hasFilter(type, "prix") && (
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
            <p className="text-xs text-ink-muted">Les annonces sans prix sont exclues dès qu’un prix est indiqué.</p>
          </fieldset>
        )}

        {hasFilter(type, "annonceur") && (
          <Field label="Annonceur">
            {(props) => (
              <Select {...props} name="annonceur" defaultValue={params.annonceur ?? ""}>
                <option value="">Tous</option>
                {Object.entries(SELLERS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {hasFilter(type, "quand") && (
          <Field label="Quand ?">
            {(props) => (
              <Select {...props} name="quand" defaultValue={params.quand ?? ""}>
                <option value="">Toutes les dates à venir</option>
                {Object.entries(WHEN).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {hasFilter(type, "dispo") && (
          <Checkbox name="dispo" value="1" defaultChecked={params.dispo} label="Disponibles uniquement" description="Disponibilité déclarée par l’annonceur." />
        )}
        <Checkbox
          name="verifie"
          value="1"
          defaultChecked={params.verifie}
          label="Informations vérifiées uniquement"
          description="Contrôlées par l’équipe locale et encore à jour."
        />

        {!type && <p className="text-sm text-ink-muted">Choisissez un type de résultats pour filtrer par catégorie, prix ou date.</p>}

        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Appliquer
        </button>
      </Form>
    </details>
  );
}
