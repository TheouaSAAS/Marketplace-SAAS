/**
 * Pré-remplissage d'une offre à partir d'un texte collé (offre déjà parue sur
 * LinkedIn, un site ou une affiche). Règles fixes, sans IA ni accès au site
 * d'origine : la plateforme ne récupère rien elle-même. L'aide par IA viendra
 * au niveau 23 ; la personne relit et corrige toujours avant d'envoyer.
 */
import type { Contract } from "./attributes";

export interface OfferDraft {
  titre: string | null;
  description: string;
  contrat: Contract | null;
  date_limite: string | null;
  email: string | null;
  lien: string | null;
  /** Ce qui a été reconnu, pour l'expliquer. */
  found: string[];
}

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const CONTRACT_WORDS: [RegExp, Contract][] = [
  [/\bcdi\b|contrat a duree indeterminee/, "cdi"],
  [/\bcdd\b|contrat a duree determinee/, "cdd"],
  [/\bstages?\b|\bstagiaire\b|\binternship\b/, "stage"],
  [/\binterim\b/, "interim"],
  [/\bfreelance\b|\bconsultant\b|\bmission\b/, "freelance"],
  [/\btemps partiel\b|\bpart[- ]time\b/, "temps_partiel"],
  [/\bapprentissage\b|\balternance\b/, "apprentissage"],
];

const pad = (value: number) => String(value).padStart(2, "0");

function deadline(text: string, now: Date): string | null {
  const numeric = /(?:avant le|au plus tard le|date limite[^0-9]{0,20}|jusqu.au)\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(text);
  const written = /(?:avant le|au plus tard le|date limite[^0-9]{0,20}|jusqu.au)\s*(\d{1,2})(?:er)? (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?: (\d{4}))?/.exec(text);
  let day: number, month: number, year: number;
  if (numeric) [day, month, year] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
  else if (written) [day, month, year] = [Number(written[1]), MONTHS[written[2]!]!, written[3] ? Number(written[3]) : now.getUTCFullYear()];
  else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseOfferText(text: string, now: Date): OfferDraft {
  const clean = text.replace(/\r\n?/g, "\n").trim().slice(0, 10_000);
  const normalized = clean
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const found: string[] = [];
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);
  const titre = lines[0] && lines[0].length >= 5 ? lines[0].slice(0, 120) : null;
  if (titre) found.push("titre (première ligne)");
  const contrat = CONTRACT_WORDS.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
  if (contrat) found.push("type de contrat");
  const date_limite = deadline(normalized, now);
  if (date_limite) found.push("date limite");
  const email = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i.exec(clean)?.[0] ?? null;
  if (email) found.push("adresse e-mail de candidature");
  const lien = /https:\/\/[^\s<>()"]+/i.exec(clean)?.[0]?.replace(/[.,;]+$/, "") ?? null;
  if (lien) found.push("lien de candidature");
  return { titre, description: (titre ? lines.slice(1) : lines).join("\n"), contrat, date_limite, email, lien, found };
}
