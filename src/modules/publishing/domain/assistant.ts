/**
 * Assistant de saisie SANS IA : catégorie probable et champs repérés dans un
 * texte collé, par règles fixes. Chaque suggestion cite l'extrait d'où elle
 * vient et un niveau de confiance ; rien n'est déduit hors du texte, et rien
 * n'est appliqué sans décision de l'auteur.
 */
import { ATTRIBUTE_SCHEMAS } from "@/modules/listings/domain/attributes";
import type { PriceUnit } from "./fields";

export type SuggestionOrigin = "regles" | "ia";
export type SuggestionInput = "texte" | "photo" | "pdf";

/** Champ visé : `title`, `description`, `price`, `priceUnit`, `negotiable`, `contactPhone`, `contactEmail`, `category` ou `attributes.<clé>`. */
export interface Suggestion {
  field: string;
  value: unknown;
  confidence: number;
  excerpt: string | null;
  origin: SuggestionOrigin;
  input: SuggestionInput;
}

export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface CategoryChoice {
  id: string;
  name: string;
  keywords: string[];
  parentName: string | null;
}

const STOP_WORDS = new Set(["et", "de", "des", "du", "la", "le", "les", "a", "au", "aux", "en", "pour", "un", "une", "autres", "autre"]);

const terms = (value: string) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

const stem = (word: string) => word.replace(/(s|x)$/, "");

/** Catégories probables pour une description libre (au plus 3), par mots-clés et noms de catégorie. */
export function suggestCategories(text: string, categories: CategoryChoice[]): { id: string; name: string; confidence: number; matched: string[] }[] {
  const words = new Set(terms(text).map(stem));
  if (words.size === 0) return [];
  const normalizedText = ` ${normalize(text)} `;
  return categories
    .map((category) => {
      const matched = new Set<string>();
      for (const keyword of category.keywords) {
        const key = normalize(keyword);
        if (key.includes(" ") ? normalizedText.includes(` ${key}`) : words.has(stem(key))) matched.add(keyword);
      }
      for (const word of terms(category.name)) if (words.has(stem(word))) matched.add(word);
      return { id: category.id, name: category.parentName ? `${category.parentName} › ${category.name}` : category.name, matched: [...matched] };
    })
    .filter((candidate) => candidate.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.name.localeCompare(b.name, "fr"))
    .slice(0, 3)
    .map((candidate) => ({ ...candidate, confidence: Math.min(0.9, 0.4 + 0.15 * candidate.matched.length) }));
}

const AMOUNT = /(\d{1,3}(?:[ . ]\d{3})+|\d+(?:[.,]\d+)?)\s*(millions?|mille|k)?\s*(?:f\s?cfa|fcfa|cfa|xof|francs?|f)\b/;

function parseAmount(raw: string, multiplier: string | undefined): number | null {
  const compact = raw.replace(/[  ]/g, "");
  const value = /^\d{1,3}(\.\d{3})+$/.test(compact) ? Number(compact.replace(/\./g, "")) : Number(compact.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const factor = multiplier?.startsWith("million") ? 1_000_000 : multiplier === "mille" || multiplier === "k" ? 1_000 : 1;
  const amount = Math.round(value * factor);
  return amount > 0 && amount < 1_000_000_000_000 ? amount : null;
}

const UNIT_WORDS: [RegExp, PriceUnit][] = [
  [/\b(par mois|\/ ?mois|mensuel(le)?|le mois)\b/, "par_mois"],
  [/\b(par nuit|\/ ?nuit|la nuit|par nuitee)\b/, "par_nuit"],
  [/\b(par jour|\/ ?jour|la journee|par journee)\b/, "par_jour"],
  [/\b(par heure|\/ ?h\b|de l heure)\b/, "par_heure"],
  [/\b(a partir de|des)\b(?= \d)/, "a_partir_de"],
];

const BRANDS = ["toyota", "peugeot", "renault", "nissan", "hyundai", "kia", "mercedes", "honda", "suzuki", "mitsubishi", "ford", "volkswagen", "yamaha", "mazda", "isuzu", "samsung", "apple", "iphone", "tecno", "infinix", "itel", "xiaomi", "huawei", "lg", "hp", "dell", "lenovo"];

function find(text: string, pattern: RegExp): RegExpExecArray | null {
  return pattern.exec(text);
}

/** Champs repérés dans un texte collé, selon le schéma d'attributs de la catégorie. */
export function extractFromText(raw: string, schema: string | null, now: Date): Suggestion[] {
  const source = raw.replace(/\r/g, "").trim();
  if (source.length < 3) return [];
  const text = normalize(source);
  const out: Suggestion[] = [];
  const add = (field: string, value: unknown, confidence: number, excerpt: string | null) => out.push({ field, value, confidence, excerpt, origin: "regles", input: "texte" });

  const firstLine = source.split("\n").map((line) => line.trim()).find((line) => line.length >= 5);
  if (firstLine) add("title", firstLine.slice(0, 120), firstLine.length <= 120 ? 0.5 : 0.3, firstLine.slice(0, 120));
  if (source.length >= 20) add("description", source.slice(0, 10000), 0.6, null);

  const amount = find(text, AMOUNT);
  if (amount) {
    const price = parseAmount(amount[1]!, amount[2]);
    if (price !== null) add("price", price, 0.7, amount[0]);
  }
  for (const [pattern, unit] of UNIT_WORDS) {
    const match = find(text, pattern);
    if (match) {
      add("priceUnit", unit, 0.6, match[0]);
      break;
    }
  }
  const negotiable = find(text, /\b(a debattre|negociable|prix discutable)\b/);
  if (negotiable) add("negotiable", true, 0.8, negotiable[0]);

  const phone = find(source, /(?:\+|00)?225[\s.-]?(?:\d{2}[\s.-]?){5}|\b0\d(?:[\s.-]?\d{2}){4}\b/);
  if (phone) {
    const digits = phone[0].replace(/\D/g, "").replace(/^00/, "").replace(/^225/, "");
    if (digits.length === 10) add("contactPhone", `+225 ${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`, 0.8, phone[0]);
  }
  const email = find(source, /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) add("contactEmail", email[0].toLowerCase(), 0.9, email[0]);

  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  if (!definitions) return out;
  const attribute = (key: string, value: unknown, confidence: number, excerpt: string) => {
    if (Object.hasOwn(definitions, key)) add(`attributes.${key}`, value, confidence, excerpt);
  };
  const integer = (key: string, pattern: RegExp, confidence = 0.7) => {
    const match = find(text, pattern);
    if (match) attribute(key, Number(match[1]!.replace(/[ .]/g, "")), confidence, match[0]);
  };

  if (schema === "immobilier") {
    integer("chambres", /\b(\d{1,2}) ?(?:chambres?|ch\b)/);
    integer("pieces", /\b(\d{1,2}) ?(?:pieces?|p\b)/);
    integer("surface_m2", /\b(\d{1,5}) ?(?:m2|m²|metres? carres?)/);
    integer("salles_de_bain", /\b(\d) ?(?:salles? de bains?|salles? d eau|douches?)\b/, 0.6);
    const kind = find(text, /\b(studio|appartement|maison|villa|chambre|duplex|bureau|magasin|terrain)\b/);
    if (kind) attribute("type_bien", kind[1], 0.6, kind[0]);
    const furnished = find(text, /\b(non meublee?|meublee?)\b/);
    if (furnished) attribute("meuble", !furnished[1]!.startsWith("non"), 0.7, furnished[0]);
  }
  if (schema === "vehicule") {
    const year = find(text, /\b(?:annee|modele|mise en circulation)?\s*((?:19[89]|20[0-4])\d)\b/);
    if (year && Number(year[1]) <= now.getFullYear() + 1) attribute("annee", Number(year[1]), 0.6, year[0].trim());
    integer("kilometrage", /\b(\d{1,3}(?:[ .]\d{3})+|\d{1,7}) ?km\b/);
    const fuel = find(text, /\b(essence|diesel|gasoil|hybride|electrique)\b/);
    if (fuel) attribute("carburant", fuel[1] === "gasoil" ? "diesel" : fuel[1], 0.8, fuel[0]);
    const gearbox = find(text, /\b(?:boite )?(manuelle|automatique)\b/);
    if (gearbox) attribute("boite", gearbox[1], 0.8, gearbox[0]);
  }
  if (schema === "vehicule" || schema === "bien") {
    const brand = BRANDS.find((name) => new RegExp(`\\b${name}\\b`).test(text));
    if (brand) attribute("marque", brand === "iphone" ? "Apple" : brand.charAt(0).toUpperCase() + brand.slice(1), 0.6, brand);
  }
  if (schema === "bien") {
    const state = find(text, /\b(neuf|tres bon etat|bon etat|etat correct|pour pieces)\b/);
    const STATES: Record<string, string> = { neuf: "neuf", "tres bon etat": "tres_bon", "bon etat": "bon", "etat correct": "correct", "pour pieces": "pour_pieces" };
    if (state) attribute("etat", STATES[state[1]!], 0.7, state[0]);
  }
  if (schema === "service") {
    const home = find(text, /\b(a domicile|je me deplace|deplacement possible)\b/);
    if (home) attribute("deplacement", true, 0.7, home[0]);
  }
  if (schema === "formation") {
    const duration = find(text, /\b(\d{1,3} (?:heures?|jours?|semaines?|mois))\b/);
    if (duration) attribute("duree", duration[1], 0.6, duration[0]);
    const certified = find(text, /\b(certifiante|certificat|diplomante)\b/);
    if (certified) attribute("certifiante", true, 0.6, certified[0]);
  }
  return out;
}
