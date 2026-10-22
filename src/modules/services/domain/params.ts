/**
 * Critères de l'annuaire des services, dans l'adresse (forme canonique).
 * La disponibilité est déclarative : « disponibles » = disponibilité
 * déclarée il y a moins de 30 jours, jamais du temps réel.
 */

export const AVAILABLE_DAYS = 30;

export const CONTACT_MODES = {
  devis: "Accepte les demandes de devis",
  telephone: "Téléphone indiqué",
  whatsapp: "WhatsApp indiqué",
} as const;
export type ContactMode = keyof typeof CONTACT_MODES;

export interface ServiceFilters {
  q: string;
  metier: string | null;
  quartier: string | null;
  verifie: boolean;
  dispo: boolean;
  contact: ContactMode | null;
  rayon: number | null;
  tri: "proximite" | null;
  page: number;
}

export const EMPTY_SERVICE_FILTERS: ServiceFilters = {
  q: "",
  metier: null,
  quartier: null,
  verifie: false,
  dispo: false,
  contact: null,
  rayon: null,
  tri: null,
  page: 1,
};

type Raw = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const slug = (value: string | undefined) => (value && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80 ? value : null);
const int = (value: string | undefined, max: number) => (value && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null);

export function parseServiceFilters(raw: Raw): ServiceFilters {
  const contact = first(raw.contact);
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    metier: slug(first(raw.metier)),
    quartier: slug(first(raw.quartier)),
    verifie: first(raw.verifie) === "1",
    dispo: first(raw.dispo) === "1",
    contact: contact && Object.hasOwn(CONTACT_MODES, contact) ? (contact as ContactMode) : null,
    rayon: int(first(raw.rayon), 100),
    tri: first(raw.tri) === "proximite" ? "proximite" : null,
    page: int(first(raw.page), 1000) ?? 1,
  };
}

export function serviceQuery(filters: ServiceFilters): string {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.metier) query.set("metier", filters.metier);
  if (filters.quartier) query.set("quartier", filters.quartier);
  if (filters.verifie) query.set("verifie", "1");
  if (filters.dispo) query.set("dispo", "1");
  if (filters.contact) query.set("contact", filters.contact);
  if (filters.rayon) query.set("rayon", String(filters.rayon));
  if (filters.tri) query.set("tri", filters.tri);
  if (filters.page > 1) query.set("page", String(filters.page));
  return query.toString();
}

/** Règle de classement affichée (« Pourquoi cet ordre ? »). */
export const SERVICES_RANKING_RULE =
  "D’abord les professionnels dont les informations ont été vérifiées par l’équipe locale (vérification de moins d’un an), puis ceux qui ont déclaré leur disponibilité depuis moins de 30 jours, puis les fiches les plus récemment mises à jour. Avec votre position, vous pouvez trier par distance. Aucune mise en avant n’est payante à ce jour.";
