/**
 * Lecture, écriture et affichage d'un champ du brouillon désigné par son nom
 * (`title`, `price`, `attributes.chambres`…) : utilisé par les suggestions.
 */
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import { PRICE_UNITS, type ListingDraft } from "./fields";

const DRAFT_LABELS: Record<string, string> = {
  title: "Titre",
  description: "Description",
  price: "Prix",
  priceUnit: "Unité du prix",
  negotiable: "Prix à débattre",
  contactPhone: "Téléphone",
  contactEmail: "E-mail",
};

const NUMBER = new Intl.NumberFormat("fr-FR");

export function fieldLabel(field: string, schema: string | null): string {
  if (field.startsWith("attributes.")) {
    const key = field.slice("attributes.".length);
    return (schema ? ATTRIBUTE_SCHEMAS[schema]?.[key]?.label : undefined) ?? key;
  }
  return DRAFT_LABELS[field] ?? field;
}

export function getField(draft: ListingDraft, field: string): unknown {
  if (field.startsWith("attributes.")) return draft.attributes[field.slice("attributes.".length)];
  return (draft as unknown as Record<string, unknown>)[field];
}

/** Nouveau brouillon avec le champ modifié (valeur `undefined` ou `null` : champ vidé). */
export function setField(draft: ListingDraft, field: string, value: unknown): ListingDraft {
  if (field.startsWith("attributes.")) {
    const key = field.slice("attributes.".length);
    const attributes = { ...draft.attributes };
    if (value === undefined || value === null || value === "") delete attributes[key];
    else attributes[key] = value;
    return { ...draft, attributes };
  }
  if (!Object.hasOwn(DRAFT_LABELS, field)) return draft;
  const empty = field === "title" || field === "description" ? "" : field === "negotiable" ? false : null;
  return { ...draft, [field]: value === undefined || value === null ? empty : value };
}

export function displayValue(field: string, value: unknown, schema: string | null): string {
  if (value === undefined || value === null || value === "") return "(vide)";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (field === "price" && typeof value === "number") return `${NUMBER.format(value)} F CFA`;
  if (field === "priceUnit" && typeof value === "string") return PRICE_UNITS[value as keyof typeof PRICE_UNITS] ?? value;
  if (field.startsWith("attributes.") && schema) {
    const type = ATTRIBUTE_SCHEMAS[schema]?.[field.slice("attributes.".length)]?.type;
    if (type?.kind === "choice" && typeof value === "string") return type.options[value] ?? value;
    if (type?.kind === "list" && Array.isArray(value)) return value.map((item) => type.options[item as string] ?? String(item)).join(", ");
    if (type?.kind === "integer" && typeof value === "number") return `${NUMBER.format(value)}${type.unit ? ` ${type.unit}` : ""}`;
  }
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}
