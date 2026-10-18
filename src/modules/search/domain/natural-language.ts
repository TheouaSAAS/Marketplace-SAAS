import type { SearchParams } from "./params";
import { WHEN } from "./params";

/**
 * Interprétation d'une phrase en filtres structurés, par règles fixes (sans IA).
 *
 * Principes :
 * - aucun critère n'est inventé : seules des expressions explicites sont
 *   reconnues (« à louer », « près de moi », « ce week-end », « moins de
 *   100 000 F », « à Bardot » pour un quartier existant) ;
 * - chaque critère reconnu est restitué en clair (`understood`) et la
 *   recherche du texte exact reste toujours possible ;
 * - les mots non reconnus restent des mots-clés, les mots de liaison
 *   (« je cherche un… ») sont retirés.
 *
 * Le même format de sortie servira à une future interprétation par IA
 * (drapeau `ai_search`), qui devra respecter les mêmes contraintes.
 */

export interface InterpretationContext {
  neighborhoods: readonly { slug: string; name: string; altNames?: readonly string[] }[];
  categorySlugs: ReadonlySet<string>;
}

export type InterpretedFilters = Partial<Pick<SearchParams, "type" | "categorie" | "quartier" | "quand" | "prixMin" | "prixMax" | "tri">>;

export interface Interpretation {
  /** Mots-clés restants, dans leur forme d'origine. */
  keywords: string;
  filters: InterpretedFilters;
  /** « Près de moi » demandé (la position reste soumise à autorisation). */
  near: boolean;
  /** Critères reconnus, en clair, dans l'ordre de la phrase. */
  understood: string[];
}

export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface Token {
  original: string;
  norm: string;
  used: boolean;
}

function tokenize(text: string): Token[] {
  return text
    .split(/[\s’'\-,;!?()«»"]+/)
    .map((original) => ({ original, norm: normalizeWord(original), used: false }))
    .filter((token) => token.norm !== "");
}

/** Cherche une expression (mots normalisés) parmi les mots non encore utilisés ; renvoie sa position. */
function find(tokens: Token[], phrase: string, from = 0): number {
  const words = phrase.split(" ");
  for (let start = from; start <= tokens.length - words.length; start++) {
    if (words.every((word, offset) => !tokens[start + offset]!.used && tokens[start + offset]!.norm === word)) return start;
  }
  return -1;
}

function consume(tokens: Token[], start: number, length: number): void {
  for (let index = start; index < start + length; index++) tokens[index]!.used = true;
}

/** Consomme la première expression trouvée parmi `phrases` ; renvoie sa position ou -1. */
function take(tokens: Token[], phrases: readonly string[]): number {
  for (const phrase of phrases) {
    const at = find(tokens, phrase);
    if (at >= 0) {
      consume(tokens, at, phrase.split(" ").length);
      return at;
    }
  }
  return -1;
}

const NEAR = ["pres de moi", "autour de moi", "proche de moi", "a cote de moi", "pres d ici", "a proximite", "dans les environs"];

const WHEN_PHRASES: [keyof typeof WHEN, string[]][] = [
  ["aujourdhui", ["aujourd hui", "aujourdhui", "ce soir", "ce jour"]],
  ["demain", ["demain soir", "demain"]],
  ["weekend", ["ce week end", "ce weekend", "ce we", "le week end", "le weekend", "week end", "weekend"]],
  ["semaine", ["cette semaine"]],
  ["mois", ["ce mois ci", "ce mois"]],
];

const EVENT_WORDS = ["que faire", "quoi faire", "activites", "activite", "sorties", "sortie", "evenements", "evenement", "agenda"];
const RENT = ["a louer", "en location", "location", "louer", "loue"];
const SALE = ["a vendre", "en vente", "vente", "vendre", "achat", "acheter"];
const CHEAP = ["pas cher", "pas chere", "pas chers", "moins cher", "bon marche", "petit prix", "petits prix"];
const JOBS: [string, string[]][] = [
  ["stages", ["stages", "stage"]],
  ["emploi-stages", ["offres d emploi", "offre d emploi", "emplois", "emploi", "jobs", "job", "recrutement", "recrute"]],
];

const HOUSING = new Set([
  "studio", "studios", "appartement", "appartements", "appart", "apparts", "maison", "maisons", "villa", "villas",
  "chambre", "chambres", "logement", "logements", "duplex", "magasin", "magasins", "bureau", "bureaux", "local", "locaux",
]);
const LAND = new Set(["terrain", "terrains", "lot", "lots", "parcelle", "parcelles"]);

const MAX_PREFIXES = ["moins de", "pas plus de", "jusqu a", "au plus", "maximum", "max", "budget de", "budget"];
const MIN_PREFIXES = ["plus de", "au moins", "a partir de", "minimum", "min"];
const MONEY_UNITS = new Set(["f", "fr", "frs", "fcfa", "cfa", "franc", "francs", "xof"]);

const FILLERS = new Set([
  "je", "j", "cherche", "cherchons", "recherche", "besoin", "voudrais", "veux", "trouver", "un", "une", "des", "du", "de",
  "d", "le", "la", "les", "l", "au", "aux", "pour", "en", "a", "quel", "quelle", "quels", "quelles", "ou", "y", "il", "est",
  "qui", "me", "mon", "ma", "mes", "svp", "sur", "dans",
]);

const AMOUNT = new Intl.NumberFormat("fr-FR");

/** Montant explicite après un préfixe (« moins de 150 000 F », « max 50k »). */
function takeAmount(tokens: Token[], prefixes: readonly string[]): number | null {
  for (const prefix of prefixes) {
    let from = 0;
    for (let at = find(tokens, prefix, from); at >= 0; at = find(tokens, prefix, from)) {
      from = at + 1;
      let index = at + prefix.split(" ").length;
      let digits = "";
      let multiplier = 1;
      // Groupes de chiffres : « 150 000 », « 150000 », « 150.000 », « 50k ».
      while (index < tokens.length && !tokens[index]!.used) {
        const norm = tokens[index]!.norm;
        const match = /^(\d+)(k?)$/.exec(norm);
        if (!match || (digits !== "" && match[1]!.length !== 3)) break;
        digits += match[1];
        if (match[2]) multiplier = 1000;
        index++;
        if (match[2]) break;
      }
      if (!digits) continue;
      let hasUnit = multiplier === 1000;
      const unit = tokens[index];
      if (unit && !unit.used && (unit.norm === "mille" || unit.norm === "k")) {
        multiplier = 1000;
        hasUnit = true;
        index++;
      }
      const currency = tokens[index];
      if (currency && !currency.used && MONEY_UNITS.has(currency.norm)) {
        hasUnit = true;
        index++;
      }
      const value = Number(digits) * multiplier;
      // Sans unité, un petit nombre n'est pas un prix (« moins de 3 pièces »).
      if (!hasUnit && value < 1000) continue;
      consume(tokens, at, index - at);
      return value;
    }
  }
  return null;
}

function takeNeighborhood(tokens: Token[], context: InterpretationContext): { slug: string; name: string } | null {
  const candidates = context.neighborhoods
    .flatMap((neighborhood) =>
      [neighborhood.name, ...(neighborhood.altNames ?? [])].map((label) => ({
        neighborhood,
        words: tokenize(label).map((token) => token.norm),
      })),
    )
    .filter((candidate) => candidate.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length);
  const prefixes = ["dans le quartier", "dans le quartier de", "quartier de", "quartier", "a cote de", "pres de", "pres du", "vers", "au", "aux", "a", "sur"];
  for (const { neighborhood, words } of candidates) {
    for (const prefix of prefixes) {
      const at = find(tokens, `${prefix} ${words.join(" ")}`);
      if (at >= 0) {
        consume(tokens, at, prefix.split(" ").length + words.length);
        return { slug: neighborhood.slug, name: neighborhood.name };
      }
    }
  }
  return null;
}

export function interpretQuery(text: string, context: InterpretationContext): Interpretation {
  const tokens = tokenize(text);
  const filters: InterpretedFilters = {};
  const understood: { at: number; label: string }[] = [];
  const note = (at: number, label: string) => understood.push({ at, label });
  const hasCategory = (slug: string) => context.categorySlugs.has(slug);

  const nearAt = take(tokens, NEAR);
  const near = nearAt >= 0;
  if (near) note(nearAt, "Près de vous");

  const remaining = () => tokens.filter((token) => !token.used).map((token) => token.norm);

  // Les annonces passent d'abord : une période (« ce week-end ») ne s'applique qu'aux événements.
  const rentAt = take(tokens, RENT);
  const saleAt = rentAt >= 0 ? -1 : take(tokens, SALE);
  if (rentAt >= 0 || saleAt >= 0) {
    filters.type = "annonces";
    const words = remaining();
    const land = words.some((word) => LAND.has(word));
    const housing = words.some((word) => HOUSING.has(word));
    const category =
      rentAt >= 0
        ? housing && hasCategory("immobilier-location") ? "immobilier-location" : null
        : land && hasCategory("terrains") ? "terrains" : housing && hasCategory("immobilier-vente") ? "immobilier-vente" : null;
    if (category) filters.categorie = category;
    const what = rentAt >= 0 ? "à louer" : "à vendre";
    note(Math.max(rentAt, saleAt), category ? `Annonces immobilières ${what}` : `Annonces ${what}`);
  }

  if (!filters.categorie) {
    for (const [slug, phrases] of JOBS) {
      if (!hasCategory(slug)) continue;
      const at = take(tokens, phrases);
      if (at >= 0) {
        filters.type = "annonces";
        filters.categorie = slug;
        note(at, slug === "stages" ? "Annonces · stages" : "Annonces · emploi");
        break;
      }
    }
  }

  if (!filters.type) {
    for (const [when, phrases] of WHEN_PHRASES) {
      const at = take(tokens, phrases);
      if (at >= 0) {
        filters.quand = when;
        filters.type = "evenements";
        note(at, `Événements · ${WHEN[when].toLowerCase()}`);
        break;
      }
    }
    const eventAt = take(tokens, EVENT_WORDS);
    if (eventAt >= 0 && !filters.type) {
      filters.type = "evenements";
      note(eventAt, "Événements");
    }
  }

  // Prix et « pas cher » : uniquement pour les annonces (sinon les mots restent des mots-clés).
  if ((filters.type ?? "annonces") === "annonces") {
    const cheapAt = take(tokens, CHEAP);
    if (cheapAt >= 0) {
      filters.type = "annonces";
      filters.tri = "prix_asc";
      note(cheapAt, "Prix croissant");
    }
    const maxPrice = takeAmount(tokens, MAX_PREFIXES);
    const minPrice = takeAmount(tokens, MIN_PREFIXES);
    if (maxPrice !== null || minPrice !== null) {
      filters.type = "annonces";
      if (maxPrice !== null) filters.prixMax = maxPrice;
      if (minPrice !== null) filters.prixMin = minPrice;
      const label =
        maxPrice !== null && minPrice !== null
          ? `Entre ${AMOUNT.format(minPrice)} et ${AMOUNT.format(maxPrice)} FCFA`
          : maxPrice !== null
            ? `Jusqu’à ${AMOUNT.format(maxPrice)} FCFA`
            : `À partir de ${AMOUNT.format(minPrice!)} FCFA`;
      note(tokens.length, label);
    }
  }

  const neighborhood = takeNeighborhood(tokens, context);
  if (neighborhood) {
    filters.quartier = neighborhood.slug;
    note(tokens.length, `Quartier : ${neighborhood.name}`);
  }

  const keywords = tokens
    .filter((token) => !token.used && !FILLERS.has(token.norm))
    .map((token) => token.original)
    .join(" ");

  return {
    keywords,
    filters,
    near,
    understood: understood.sort((a, b) => a.at - b.at).map((item) => item.label),
  };
}
