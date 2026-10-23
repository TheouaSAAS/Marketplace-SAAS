/**
 * Critères de l'espace emploi dans l'adresse (forme canonique).
 */
import { CONTRACTS, DOMAINS, EXPERIENCE, JOB_TYPES, ORGANIZATIONS, REMOTE, type Contract, type Domain, type Experience, type JobType, type Organization, type Remote } from "./attributes";

export const SINCE = { "7": "Depuis 7 jours", "30": "Depuis 30 jours" } as const;

export interface JobFilters {
  q: string;
  type: JobType | null;
  contrat: Contract | null;
  domaine: Domain | null;
  experience: Experience | null;
  teletravail: Remote | null;
  organisation: Organization | null;
  depuis: 7 | 30 | null;
  quartier: string | null;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const pick = <T extends Record<string, string>>(table: T, value: string | undefined) => (value && Object.hasOwn(table, value) ? (value as keyof T & string) : null);

export function parseJobFilters(raw: Raw): JobFilters {
  const quartier = first(raw.quartier);
  const page = first(raw.page);
  const depuis = first(raw.depuis);
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    type: pick(JOB_TYPES, first(raw.type)),
    contrat: pick(CONTRACTS, first(raw.contrat)),
    domaine: pick(DOMAINS, first(raw.domaine)),
    experience: pick(EXPERIENCE, first(raw.experience)),
    teletravail: pick(REMOTE, first(raw.teletravail)),
    organisation: pick(ORGANIZATIONS, first(raw.organisation)),
    depuis: depuis === "7" ? 7 : depuis === "30" ? 30 : null,
    quartier: quartier && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(quartier) ? quartier : null,
    page: page && /^\d+$/.test(page) && Number(page) >= 1 && Number(page) <= 1000 ? Number(page) : 1,
  };
}

export function jobQuery(filters: JobFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  for (const key of ["type", "contrat", "domaine", "experience", "teletravail", "organisation"] as const) {
    const value = filters[key];
    if (value) query.set(key, value);
  }
  if (filters.depuis) query.set("depuis", String(filters.depuis));
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}
