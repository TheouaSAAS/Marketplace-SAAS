import type { RealEstateFilters } from "./filters";
import { PROPERTY_TYPES_BY_MODE, type Equipment, type RealEstateMode } from "./modes";

/**
 * « Je cherche un studio meublé 2 pièces à Bardot, moins de 100 000 F » →
 * filtres immobiliers. Règles fixes (sans IA) : seules des expressions
 * explicites sont reconnues, tout critère compris est restitué en clair.
 */

export interface RealEstateInterpretation {
  keywords: string;
  filters: Partial<RealEstateFilters>;
  understood: string[];
}

const normalize = (text: string) =>
  ` ${text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’'\-,;!?()«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

const TYPES: [RegExp, string][] = [
  [/ (studios?) /, "studio"],
  [/ (chambres? a louer|chambres?)(?= )(?! \d)/, "chambre"],
  [/ (appartements?|apparts?) /, "appartement"],
  [/ (maisons?) /, "maison"],
  [/ (villas?) /, "villa"],
  [/ (duplex) /, "duplex"],
  [/ (terrains?|parcelles?|lots?) /, "terrain"],
  [/ (bureaux|bureau) /, "bureau"],
  [/ (magasins?|boutiques?) /, "magasin"],
];

const EQUIPMENT_WORDS: [RegExp, Equipment][] = [
  [/ (climatisee?s?|climatisation|clim) /, "climatisation"],
  [/ (parking) /, "parking"],
  [/ (gardien|gardiennage) /, "gardien"],
  [/ (forage) /, "forage"],
  [/ (groupe electrogene) /, "groupe_electrogene"],
];

const FILLERS = new Set(
  "je j cherche recherche besoin voudrais veux trouver un une des du de d le la les l au aux pour en a avec et ou logement logements maximum".split(" "),
);

const AMOUNT = new Intl.NumberFormat("fr-FR");

export function interpretRealEstate(
  text: string,
  mode: RealEstateMode,
  neighborhoods: readonly { slug: string; name: string }[],
): RealEstateInterpretation {
  let rest = normalize(text);
  const filters: Partial<RealEstateFilters> = {};
  const understood: string[] = [];
  const cut = (match: RegExpExecArray) => {
    rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
  };

  // Les nombres d'abord : « 3 chambres » n'est pas un type de bien.
  const rooms = / (\d{1,2}) ?(pieces?|p)(?= )/.exec(rest);
  if (rooms) {
    filters.piecesMin = Number(rooms[1]);
    understood.push(`Au moins ${rooms[1]} pièce${Number(rooms[1]) > 1 ? "s" : ""}`);
    cut(rooms);
  }
  const bedrooms = / (\d{1,2}) chambres?(?= )/.exec(rest);
  if (bedrooms) {
    filters.chambresMin = Number(bedrooms[1]);
    understood.push(`Au moins ${bedrooms[1]} chambre${Number(bedrooms[1]) > 1 ? "s" : ""}`);
    cut(bedrooms);
  }

  for (const [pattern, type] of TYPES) {
    const match = pattern.exec(rest);
    if (match && PROPERTY_TYPES_BY_MODE[mode].includes(type)) {
      filters.typeBien = type;
      understood.push(`Type : ${type}`);
      cut(match);
      break;
    }
  }

  const unfurnished = / (non meublee?s?|vide) /.exec(rest);
  const furnished = unfurnished ? null : / (meublee?s?) /.exec(rest);
  if (unfurnished || furnished) {
    filters.meuble = Boolean(furnished);
    understood.push(furnished ? "Meublé" : "Non meublé");
    cut((unfurnished ?? furnished)!);
  }

  const price = / (moins de|max|jusqu a|budget de|budget|pas plus de) ((?:\d{1,3}(?: \d{3})+|\d+)) ?(k|mille|millions?)? ?(f|fr|frs|fcfa|cfa|francs?)? /.exec(rest);
  if (price) {
    const multiplier = price[3] === "k" || price[3] === "mille" ? 1000 : price[3]?.startsWith("million") ? 1_000_000 : 1;
    const value = Number(price[2]!.replace(/ /g, "")) * multiplier;
    if (multiplier > 1 || price[4] || value >= 1000) {
      filters.prixMax = value;
      understood.push(`Jusqu’à ${AMOUNT.format(value)} FCFA`);
      cut(price);
    }
  }

  const available = / (disponible|libre|immediatement) /.exec(rest);
  if (available) {
    filters.dispo = true;
    understood.push("Disponibles (déclaré)");
    cut(available);
  }

  for (const [pattern, key] of EQUIPMENT_WORDS) {
    const match = pattern.exec(rest);
    if (match) {
      filters.equipements = [...(filters.equipements ?? []), key];
      understood.push(`Équipement : ${match[1]}`);
      cut(match);
    }
  }

  for (const neighborhood of [...neighborhoods].sort((a, b) => b.name.length - a.name.length)) {
    const name = normalize(neighborhood.name).trim();
    const match = new RegExp(` (a|au|aux|vers|quartier|dans le quartier|cote|pres de) ${name} `).exec(rest);
    if (match) {
      filters.quartier = neighborhood.slug;
      understood.push(`Quartier : ${neighborhood.name}`);
      cut(match);
      break;
    }
  }

  const keywords = rest
    .split(" ")
    .filter((word) => word && !FILLERS.has(word))
    .join(" ");
  return { keywords, filters, understood };
}
