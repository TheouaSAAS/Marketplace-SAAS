/**
 * Carte unique des routes de l'application.
 *
 * - `live`    : page terminée et validée ; liens actifs, indexable (sauf `private`).
 * - `preview` : la page existe avec un écran d'attente explicite (« rubrique en
 *               préparation ») ; liens actifs, jamais indexée ni dans le sitemap.
 * - `planned` : pas encore de page ; liens affichés « Bientôt », non cliquables.
 *
 * Quand une page est terminée et testée, passer son statut à `live` ici :
 * menus, pied de page et sitemap se mettent à jour automatiquement.
 * Ne jamais écrire un chemin en dur ailleurs : utiliser `href()`.
 */

export type RouteStatus = "live" | "preview" | "planned";

export interface AppRoute {
  path: string;
  label: string;
  /** Niveau du plan de construction (docs/build-state.md) qui livre la page complète. */
  level: number;
  status: RouteStatus;
  /** Page à exclure du sitemap et des moteurs de recherche. */
  private?: boolean;
}

export const ROUTES = {
  home: { path: "/", label: "Accueil", level: 5, status: "live" },
  newcomer: { path: "/nouveau-arrivant", label: "Nouveau à San Pedro ?", level: 6, status: "live" },
  newcomerQuestions: { path: "/nouveau-arrivant/questions", label: "Questionnaire", level: 6, status: "live", private: true },
  newcomerPlan: { path: "/nouveau-arrivant/plan", label: "Mon plan", level: 6, status: "live", private: true },
  search: { path: "/recherche", label: "Recherche", level: 7, status: "live", private: true },

  // Annonces & opportunités
  listings: { path: "/annonces", label: "Annonces", level: 7, status: "preview" },
  listingDetail: { path: "/annonces/[slug]", label: "Détail d’une annonce", level: 8, status: "live" },
  realEstate: { path: "/immobilier", label: "Immobilier", level: 9, status: "live" },
  realEstateMode: { path: "/immobilier/[mode]", label: "Recherche immobilière", level: 9, status: "live" },
  realEstateCompare: { path: "/immobilier/comparer", label: "Comparer des biens", level: 9, status: "live", private: true },
  realEstateAdvice: { path: "/immobilier/conseils", label: "Conseils pour se loger", level: 9, status: "live" },
  jobs: { path: "/emploi", label: "Emploi et opportunités", level: 17, status: "preview" },
  publish: { path: "/publier", label: "Publier une annonce", level: 18, status: "preview" },

  // Services & professionnels
  services: { path: "/services", label: "Services de proximité", level: 10, status: "live" },
  shops: { path: "/commerces", label: "Commerces", level: 11, status: "live" },
  directory: { path: "/professionnels", label: "Professionnels et entreprises", level: 19, status: "preview" },
  professionalDetail: { path: "/professionnels/[slug]", label: "Fiche d’un professionnel", level: 10, status: "live" },
  quoteRequests: { path: "/devis", label: "Mes demandes de devis", level: 10, status: "live", private: true },
  pricing: { path: "/offres", label: "Offres et visibilité", level: 21, status: "preview" },

  // Découvrir & sortir
  discover: { path: "/decouvrir", label: "Découvrir et sortir", level: 12, status: "live" },
  discoverEntry: { path: "/decouvrir/[entree]", label: "Découvrir", level: 12, status: "live" },
  tourism: { path: "/tourisme", label: "Tourisme", level: 12, status: "live" },
  itinerary: { path: "/tourisme/itineraire", label: "Créer un itinéraire", level: 12, status: "live" },
  guide: { path: "/guide", label: "Guide pratique", level: 13, status: "live" },
  guideSection: { path: "/guide/[rubrique]", label: "Rubrique du guide", level: 13, status: "live" },
  guideArticle: { path: "/guide/[rubrique]/[article]", label: "Article du guide", level: 13, status: "live" },
  adminGuide: { path: "/admin/guide", label: "Guide : rédaction et suggestions", level: 13, status: "live", private: true },
  adminGuideArticle: { path: "/admin/guide/[id]", label: "Modifier un article", level: 13, status: "live", private: true },
  neighborhoods: { path: "/quartiers", label: "Quartiers", level: 14, status: "live" },
  neighborhoodDetail: { path: "/quartiers/[slug]", label: "Fiche d’un quartier", level: 14, status: "live" },
  adminNeighborhoods: { path: "/admin/quartiers", label: "Quartiers : fiches et périmètres", level: 14, status: "live", private: true },
  adminNeighborhood: { path: "/admin/quartiers/[slug]", label: "Modifier un quartier", level: 14, status: "live", private: true },
  map: { path: "/carte", label: "Carte interactive", level: 15, status: "live" },
  events: { path: "/evenements", label: "Événements", level: 16, status: "preview" },
  eventDetail: { path: "/evenements/[slug]", label: "Détail d’un événement", level: 16, status: "planned" },
  placeDetail: { path: "/lieux/[slug]", label: "Vitrine d’un lieu", level: 11, status: "live" },
  placeClaims: { path: "/admin/revendications", label: "Revendications de vitrines", level: 11, status: "live", private: true },
  city: { path: "/villes/[slug]", label: "Page de ville", level: 25, status: "planned" },

  // Compte
  login: { path: "/connexion", label: "Connexion", level: 3, status: "live", private: true },
  signup: { path: "/inscription", label: "Inscription", level: 3, status: "live", private: true },
  forgotPassword: { path: "/mot-de-passe-oublie", label: "Mot de passe oublié", level: 3, status: "live", private: true },
  resetPassword: { path: "/mot-de-passe/nouveau", label: "Nouveau mot de passe", level: 3, status: "live", private: true },
  authConfirm: { path: "/auth/confirmation", label: "Confirmation", level: 3, status: "live", private: true },
  profile: { path: "/profil", label: "Mon profil", level: 3, status: "live", private: true },
  profileExport: { path: "/profil/export", label: "Export de mes données", level: 3, status: "live", private: true },
  favorites: { path: "/favoris", label: "Mes favoris", level: 8, status: "live", private: true },
  messages: { path: "/messages", label: "Mes messages", level: 8, status: "live", private: true },
  messageThread: { path: "/messages/[id]", label: "Conversation", level: 8, status: "live", private: true },
  pro: { path: "/espace-pro", label: "Espace professionnel", level: 21, status: "planned", private: true },
  admin: { path: "/admin", label: "Administration", level: 22, status: "planned", private: true },
  adminCategories: { path: "/admin/categories", label: "Catégories", level: 10, status: "live", private: true },

  // Aide, confiance et informations
  help: { path: "/aide", label: "Aide", level: 4, status: "live" },
  verificationPolicy: { path: "/verification", label: "Comment nous vérifions les informations", level: 4, status: "live" },
  report: { path: "/signaler", label: "Signaler un contenu", level: 4, status: "live" },
  contact: { path: "/contact", label: "Contact", level: 4, status: "live" },
  legalNotice: { path: "/mentions-legales", label: "Mentions légales", level: 3, status: "live" },
  terms: { path: "/conditions-utilisation", label: "Conditions d’utilisation", level: 3, status: "live" },
  privacy: { path: "/confidentialite", label: "Politique de confidentialité", level: 3, status: "live" },

  // Pages techniques
  maintenance: { path: "/maintenance", label: "Maintenance", level: 4, status: "live", private: true },
  offline: { path: "/hors-ligne", label: "Hors ligne", level: 4, status: "live", private: true },
  designSystem: { path: "/design-system", label: "Système de design", level: 1, status: "live", private: true },
  internalStatus: { path: "/interne/statut", label: "Statut interne", level: 0, status: "live", private: true },
} as const satisfies Record<string, AppRoute>;

export type RouteKey = keyof typeof ROUTES;

/** Page terminée et validée (indexable si elle n'est pas privée). */
export function isLive(key: RouteKey): boolean {
  return ROUTES[key].status === "live";
}

/** Une page existe à cette adresse (terminée ou en préparation) : le lien peut être actif. */
export function hasPage(key: RouteKey): boolean {
  return ROUTES[key].status !== "planned";
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

/**
 * Nom du critère de catégorie propre à certaines pages (forme canonique de
 * leur adresse) ; « categorie » partout ailleurs.
 */
const CATEGORY_PARAMS: Partial<Record<RouteKey, string>> = { services: "metier", shops: "type", tourism: "type" };

/** Lien vers une page filtrée sur une catégorie (menus, plan nouvel arrivant). */
export function categoryHref(key: RouteKey, category: string | undefined, hash?: string): string {
  return href(key, { query: category ? { [CATEGORY_PARAMS[key] ?? "categorie"]: category } : {}, hash });
}
