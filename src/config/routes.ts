/**
 * Carte unique des routes de l'application.
 *
 * - `live`    : la page existe et a été validée ; les liens sont actifs.
 * - `planned` : la page est prévue ; les liens sont affichés « Bientôt » et ne
 *               sont pas cliquables, pour ne jamais conduire à une page cassée.
 *
 * Quand une page est terminée et testée, passer son statut à `live` ici :
 * menus, pied de page et sitemap se mettent à jour automatiquement.
 * Ne jamais écrire un chemin en dur ailleurs : utiliser `href()`.
 */

export type RouteStatus = "live" | "planned";

export interface AppRoute {
  path: string;
  label: string;
  /** Phase du plan de construction (§3.16) dans laquelle la page est livrée. */
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  status: RouteStatus;
  /** Page à exclure du sitemap et des moteurs de recherche. */
  private?: boolean;
}

export const ROUTES = {
  home: { path: "/", label: "Accueil", phase: 2, status: "live" },
  discover: { path: "/decouvrir", label: "Découvrir", phase: 2, status: "planned" },
  tourismGuide: { path: "/decouvrir/guide", label: "Guide touristique", phase: 2, status: "planned" },
  newcomer: { path: "/nouveau-arrivant", label: "Nouveau en ville ?", phase: 2, status: "planned" },
  map: { path: "/carte", label: "Carte interactive", phase: 4, status: "planned" },
  listings: { path: "/annonces", label: "Annonces", phase: 2, status: "planned" },
  listingDetail: { path: "/annonces/[slug]", label: "Détail d’une annonce", phase: 2, status: "planned" },
  realEstate: { path: "/immobilier", label: "Immobilier", phase: 2, status: "planned" },
  services: { path: "/services", label: "Services", phase: 2, status: "planned" },
  shops: { path: "/commerces", label: "Commerces", phase: 2, status: "planned" },
  jobs: { path: "/emploi", label: "Emploi et opportunités", phase: 2, status: "planned" },
  events: { path: "/evenements", label: "Événements", phase: 2, status: "planned" },
  eventDetail: { path: "/evenements/[slug]", label: "Détail d’un événement", phase: 2, status: "planned" },
  placeDetail: { path: "/lieux/[slug]", label: "Détail d’un lieu", phase: 2, status: "planned" },
  directory: { path: "/entreprises", label: "Annuaire des entreprises", phase: 2, status: "planned" },
  city: { path: "/villes/[slug]", label: "Page de ville", phase: 2, status: "planned" },
  search: { path: "/recherche", label: "Recherche", phase: 3, status: "planned" },
  publish: { path: "/publier", label: "Publier une annonce", phase: 3, status: "planned" },
  login: { path: "/connexion", label: "Connexion", phase: 4, status: "planned", private: true },
  signup: { path: "/inscription", label: "Inscription", phase: 4, status: "planned", private: true },
  profile: { path: "/profil", label: "Mon profil", phase: 4, status: "planned", private: true },
  pro: { path: "/espace-pro", label: "Espace professionnel", phase: 4, status: "planned", private: true },
  admin: { path: "/admin", label: "Administration", phase: 4, status: "planned", private: true },
  pricing: { path: "/offres", label: "Offres et abonnements", phase: 5, status: "planned" },
  contact: { path: "/contact", label: "Contact", phase: 2, status: "planned" },
  legalNotice: { path: "/mentions-legales", label: "Mentions légales", phase: 2, status: "planned" },
  terms: { path: "/conditions-utilisation", label: "Conditions d’utilisation", phase: 2, status: "planned" },
  privacy: { path: "/confidentialite", label: "Politique de confidentialité", phase: 2, status: "planned" },
  designSystem: { path: "/design-system", label: "Système de design", phase: 1, status: "live", private: true },
  internalStatus: { path: "/interne/statut", label: "Statut interne", phase: 1, status: "live", private: true },
} as const satisfies Record<string, AppRoute>;

export type RouteKey = keyof typeof ROUTES;

export function isLive(key: RouteKey): boolean {
  return ROUTES[key].status === "live";
}

type QueryValue = string | number | undefined | null;

/**
 * Construit l'URL d'une route en remplaçant ses segments dynamiques.
 * Exemple : href("listingDetail", { params: { slug: "studio-cite" } }).
 */
export function href(
  key: RouteKey,
  options: { params?: Record<string, string>; query?: Record<string, QueryValue>; hash?: string } = {},
): string {
  let path: string = ROUTES[key].path;
  for (const [name, value] of Object.entries(options.params ?? {})) {
    path = path.replace(`[${name}]`, encodeURIComponent(value));
  }
  if (path.includes("[")) {
    throw new Error(`Paramètre manquant pour la route « ${key} » (${ROUTES[key].path}).`);
  }
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(name, String(value));
  }
  const query = search.toString();
  return `${path}${query ? `?${query}` : ""}${options.hash ? `#${options.hash}` : ""}`;
}
