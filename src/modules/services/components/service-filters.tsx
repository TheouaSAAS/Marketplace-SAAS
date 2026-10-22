import Form from "next/form";
import { href } from "@/config/routes";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Select } from "@/components/ui/form-controls";
import { AVAILABLE_DAYS, CONTACT_MODES, type ServiceFilters } from "../domain/params";

const RADII = [1, 5, 10, 25];

/** Filtres de l'annuaire (GET, sans JavaScript). La distance exige une position autorisée. */
export function ServiceFiltersForm({
  filters,
  neighborhoods,
  hasPosition,
}: {
  filters: ServiceFilters;
  neighborhoods: { slug: string; name: string }[];
  hasPosition: boolean;
}) {
  return (
    <Form action={href("services")} className="flex flex-col gap-4" aria-label="Filtres des professionnels">
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      {filters.metier && <input type="hidden" name="metier" value={filters.metier} />}
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
      <Field label="Mode de contact">
        {(props) => (
          <Select {...props} name="contact" defaultValue={filters.contact ?? ""}>
            <option value="">Tous</option>
            {Object.entries(CONTACT_MODES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
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
      <Checkbox
        name="dispo"
        value="1"
        defaultChecked={filters.dispo}
        label="Disponibilité déclarée récemment"
        description={`Déclarée par le professionnel depuis moins de ${AVAILABLE_DAYS} jours, sans garantie.`}
      />
      <Checkbox name="verifie" value="1" defaultChecked={filters.verifie} label="Informations vérifiées uniquement" />
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        Appliquer
      </button>
    </Form>
  );
}
