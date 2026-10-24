import Link from "next/link";
import { href } from "@/config/routes";
import { displayedVerification, VERIFICATION_META } from "@/domain/verification";
import { formatPrice } from "@/lib/format";
import { displayAttributes } from "@/modules/listings/domain/attributes";
import { confirmationFreshness, freshnessLabel } from "../domain/freshness";
import type { RealEstateCardData } from "../server/queries";
import { availabilityText } from "@/modules/listings/domain/availability";

const ATTRIBUTE_ROWS = ["Type de bien", "Pièces", "Chambres", "Surface", "Salles de bain", "Meublé", "Équipements déclarés"];

/** Une ligne par critère, une colonne par bien ; « — » quand l'annonceur n'a rien déclaré. */
export function CompareTable({ properties, now }: { properties: RealEstateCardData[]; now: Date }) {
  const facts = properties.map((property) => new Map(displayAttributes("immobilier", property.attributes).map((fact) => [fact.label, fact.value])));
  const rows: { label: string; values: string[] }[] = [
    { label: "Prix déclaré", values: properties.map((property) => formatPrice(property.price, property.price_unit ?? "total")) },
    ...ATTRIBUTE_ROWS.map((label) => ({ label, values: facts.map((map) => map.get(label) ?? "—") })),
    { label: "Quartier", values: properties.map((property) => property.neighborhood?.name ?? "—") },
    { label: "Disponibilité", values: properties.map((property) => availabilityText(property.availability_status)) },
    {
      label: "Fraîcheur",
      values: properties.map((property) =>
        freshnessLabel(confirmationFreshness(property.last_confirmed_at, property.published_at, now), Boolean(property.last_confirmed_at)),
      ),
    },
    {
      label: "Vérification",
      values: properties.map((property) => VERIFICATION_META[displayedVerification(property.verification_status, property.verified_at, now)].label),
    },
  ];
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">Comparaison des biens sélectionnés</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="w-40 p-3 text-left text-ink-muted">
              Critère
            </th>
            {properties.map((property) => (
              <th key={property.id} scope="col" className="p-3 text-left align-top">
                <Link href={href("listingDetail", { params: { slug: property.slug } })} className="font-bold text-brand-700 hover:underline">
                  {property.title}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-0">
              <th scope="row" className="p-3 text-left font-semibold text-ink-muted">
                {row.label}
              </th>
              {row.values.map((value, index) => (
                <td key={properties[index]!.id} className="p-3 align-top">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
