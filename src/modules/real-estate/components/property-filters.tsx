import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { href } from "@/config/routes";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { CONFIRMATION_DAYS } from "../domain/freshness";
import { RE_SORTS, type RealEstateFilters } from "../domain/filters";
import { EQUIPMENTS, PROPERTY_TYPES_BY_MODE, type RealEstateMode } from "../domain/modes";

const typeLabels = (ATTRIBUTE_SCHEMAS.immobilier?.type_bien?.type as { options?: Record<string, string> } | undefined)?.options ?? {};

/** Filtres adaptés à l'entrée (pas de pièces ni de mobilier pour un local). Repliés sur mobile. */
export function PropertyFilters({
  mode,
  filters,
  neighborhoods,
}: {
  mode: RealEstateMode;
  filters: RealEstateFilters;
  neighborhoods: { slug: string; name: string }[];
}) {
  const dwelling = mode !== "professionnel";
  return (
    <details className="rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres et tri
      </summary>
      <Form action={href("realEstateMode", { params: { mode } })} className="flex flex-col gap-4 border-t border-border p-4 lg:border-0 lg:p-0">
        <h2 className="hidden text-lg font-bold lg:block">Filtres et tri</h2>
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        <Field label="Trier par">
          {(props) => (
            <Select {...props} name="tri" defaultValue={filters.tri ?? "recent"}>
              {Object.entries(RE_SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Type de bien">
          {(props) => (
            <Select {...props} name="type_bien" defaultValue={filters.typeBien ?? ""}>
              <option value="">Tous</option>
              {PROPERTY_TYPES_BY_MODE[mode].map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type] ?? type}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {dwelling && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pièces (min.)">
              {(props) => <Input {...props} name="pieces" inputMode="numeric" pattern="[0-9]*" defaultValue={filters.piecesMin ?? ""} />}
            </Field>
            <Field label="Chambres (min.)">
              {(props) => <Input {...props} name="chambres" inputMode="numeric" pattern="[0-9]*" defaultValue={filters.chambresMin ?? ""} />}
            </Field>
          </div>
        )}
        <Field label="Surface minimale (m²)">
          {(props) => <Input {...props} name="surface" inputMode="numeric" pattern="[0-9]*" defaultValue={filters.surfaceMin ?? ""} />}
        </Field>
        {dwelling && (
          <Field label="Mobilier">
            {(props) => (
              <Select {...props} name="meuble" defaultValue={filters.meuble === null ? "" : filters.meuble ? "oui" : "non"}>
                <option value="">Indifférent</option>
                <option value="oui">Meublé</option>
                <option value="non">Non meublé</option>
              </Select>
            )}
          </Field>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Budget (prix déclaré, FCFA)</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label={<span className="font-normal">Minimum</span>}>
              {(props) => <Input {...props} name="prix_min" inputMode="numeric" pattern="[0-9 .]*" defaultValue={filters.prixMin ?? ""} />}
            </Field>
            <Field label={<span className="font-normal">Maximum</span>}>
              {(props) => <Input {...props} name="prix_max" inputMode="numeric" pattern="[0-9 .]*" defaultValue={filters.prixMax ?? ""} />}
            </Field>
          </div>
          <p className="text-xs text-ink-muted">Filtre sur les prix annoncés : ce n’est ni une estimation ni un conseil financier.</p>
        </fieldset>
        {neighborhoods.length > 0 && (
          <Field label="Quartier" hint="Noms des quartiers en cours de validation locale.">
            {(props) => (
              <Select {...props} name="quartier" defaultValue={filters.quartier ?? ""}>
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
        <fieldset className="flex flex-col">
          <legend className="mb-1 text-sm font-semibold">Équipements déclarés</legend>
          {Object.entries(EQUIPMENTS).map(([key, label]) => (
            <Checkbox key={key} name="equipements" value={key} label={label} defaultChecked={(filters.equipements as string[]).includes(key)} />
          ))}
        </fieldset>
        <Checkbox name="dispo" value="1" defaultChecked={filters.dispo} label="Disponibles uniquement" description="Disponibilité déclarée par l’annonceur." />
        <Checkbox
          name="confirmee"
          value="1"
          defaultChecked={filters.confirmee}
          label={`Confirmées depuis moins de ${CONFIRMATION_DAYS} jours`}
          description="Annonces publiées ou reconfirmées récemment par l’annonceur."
        />
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Appliquer
        </button>
      </Form>
    </details>
  );
}
