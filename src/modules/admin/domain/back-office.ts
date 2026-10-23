import { href, type RouteKey } from "@/config/routes";
import { CONTENT_STATUS_META, type ContentStatus } from "@/domain/content-status";
import { isAdmin, isCurator, isStaff, type Actor } from "@/domain/roles";

/**
 * Back-office : qui accède à quoi, libellés des files et des décisions,
 * lecture de l'historique. Les droits réels sont garantis par la base ; ces
 * règles ne servent qu'à n'afficher que les outils utilisables.
 *
 * - staff   : équipe de modération (modérateur, administrateur) ;
 * - curator : équipe locale (éditeur local, administrateur) ;
 * - team    : l'une ou l'autre ;
 * - admin   : administrateurs seulement.
 */
export type Audience = "staff" | "curator" | "team" | "admin";

export function canAccess(role: Actor, audience: Audience): boolean {
  if (audience === "staff") return isStaff(role);
  if (audience === "curator") return isCurator(role);
  if (audience === "team") return isStaff(role) || isCurator(role);
  return isAdmin(role);
}

/** Volumes renvoyés par `admin_overview()`. */
export const OVERVIEW_KEYS = [
  "listings", "jobs", "businesses", "verifications", "events", "reviews", "claims", "reports", "guide_suggestions",
  "boundaries", "ai_assisted", "expired", "without_source", "to_revalidate", "reported",
] as const;
export type OverviewKey = (typeof OVERVIEW_KEYS)[number];
export type Overview = Record<OverviewKey, number>;

export interface AdminTool {
  route: RouteKey;
  /** Intitulé du lien (stable : les parcours de test s'y fient). */
  label: string;
  description: string;
  audience: Audience;
  /** Éléments en attente dans cette file. */
  counts?: { key: OverviewKey; label: string }[];
}

export const ADMIN_SECTIONS: { title: string; tools: AdminTool[] }[] = [
  {
    title: "Files de modération",
    tools: [
      { route: "adminReports", label: "Traiter les signalements", audience: "staff", description: "Examiner, classer sans suite ou suspendre aussitôt un contenu signalé.", counts: [{ key: "reports", label: "ouverts" }] },
      {
        route: "adminListings",
        label: "Modérer les annonces",
        audience: "staff",
        description: "Publier ou refuser avec motif ; les champs remplis par l’assistant IA sont signalés.",
        counts: [{ key: "listings", label: "en attente" }, { key: "ai_assisted", label: "rédigées avec l’IA" }],
      },
      { route: "adminJobs", label: "Modérer les offres d’emploi", audience: "staff", description: "Offres d’emploi, opportunités et appels d’offres.", counts: [{ key: "jobs", label: "en attente" }] },
      {
        route: "adminPros",
        label: "Modérer et vérifier les pages pro",
        audience: "team",
        description: "Publication des pages professionnelles et demandes de vérification.",
        counts: [{ key: "businesses", label: "en attente" }, { key: "verifications", label: "vérifications" }],
      },
      { route: "adminEvents", label: "Modérer les événements", audience: "staff", description: "Événements proposés par les membres et organisateurs.", counts: [{ key: "events", label: "en attente" }] },
      { route: "adminReviews", label: "Modérer les avis", audience: "staff", description: "Avis sur les lieux et les professionnels.", counts: [{ key: "reviews", label: "en attente" }] },
      { route: "placeClaims", label: "Examiner les revendications (vitrines, pages pro)", audience: "curator", description: "Exploitants qui demandent à gérer leur fiche.", counts: [{ key: "claims", label: "en attente" }] },
    ],
  },
  {
    title: "Données locales",
    tools: [
      {
        route: "adminQuality",
        label: "Tableau de bord qualité",
        audience: "team",
        description: "Contenus expirés, sans source, à revalider ou signalés.",
        counts: [{ key: "expired", label: "expirées" }, { key: "without_source", label: "sans source" }, { key: "to_revalidate", label: "à revalider" }],
      },
      { route: "adminDuplicates", label: "Fusionner les doublons de lieux", audience: "curator", description: "Fiches proches au même nom ou au même numéro : fusion tracée, doublon archivé." },
      { route: "adminSources", label: "Gérer les sources", audience: "curator", description: "Relevés terrain, sources officielles et partenaires qui fondent les vérifications." },
      { route: "adminGuide", label: "Rédiger le guide pratique", audience: "curator", description: "Articles, versions et suggestions des lecteurs.", counts: [{ key: "guide_suggestions", label: "suggestions" }] },
      { route: "adminNeighborhoods", label: "Gérer les quartiers et leurs périmètres", audience: "curator", description: "Fiches de quartier et périmètres proposés.", counts: [{ key: "boundaries", label: "périmètres à valider" }] },
      { route: "adminCategories", label: "Gérer les catégories et métiers", audience: "admin", description: "Référentiel des catégories, métiers et mots-clés de recherche." },
    ],
  },
  {
    title: "Comptes et traçabilité",
    tools: [
      { route: "adminAccounts", label: "Gérer les comptes et organisations", audience: "admin", description: "Rôles, suspensions et levées, toujours avec une raison." },
      { route: "adminAudit", label: "Consulter le journal et l’historique", audience: "team", description: "Qui a fait quoi, quand, pourquoi, avec l’avant et l’après." },
      { route: "adminPromotions", label: "Suivre les mises en avant et abonnements", audience: "admin", description: "Campagnes sponsorisées et abonnements : pause, arrêt ou refus, sans paiement en ligne." },
      { route: "adminAi", label: "Piloter l’intelligence artificielle", audience: "admin", description: "Fonctions activées, interrupteur d’arrêt, consommation du mois, base de connaissances de l’assistant." },
    ],
  },
];

export function sectionsFor(role: Actor) {
  return ADMIN_SECTIONS.map((section) => ({ ...section, tools: section.tools.filter((tool) => canAccess(role, tool.audience)) })).filter((section) => section.tools.length > 0);
}

/** Cycle de publication commun, appliqué par la base (content_transition_allowed). */
export const PUBLICATION_WORKFLOW = [
  { status: "Brouillon", explain: "L’auteur rédige ; rien n’est public." },
  { status: "En revue", explain: "Soumis : l’équipe de modération examine." },
  { status: "Validé ou refusé", explain: "Refus toujours motivé ; l’auteur corrige puis resoumet. La vérification (source, date, responsable) est distincte." },
  { status: "Publié", explain: "Visible du public ; toute modification par l’auteur repasse en revue." },
  { status: "Archivé", explain: "Retiré, conservé avec son historique ; un doublon fusionné est archivé." },
] as const;

// -----------------------------------------------------------------------------
// Signalements
// -----------------------------------------------------------------------------
export const REPORT_TARGET_TYPES = ["listing", "place", "event", "business", "comment", "review", "article", "message"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_TARGETS: Record<ReportTargetType, { label: string; suspend: string | null }> = {
  listing: { label: "Annonce", suspend: "Suspendre l’annonce" },
  place: { label: "Vitrine ou lieu", suspend: "Suspendre la fiche" },
  event: { label: "Événement", suspend: "Suspendre l’événement" },
  business: { label: "Page professionnelle", suspend: "Suspendre la page" },
  comment: { label: "Commentaire", suspend: "Masquer le commentaire" },
  review: { label: "Avis", suspend: "Masquer l’avis" },
  article: { label: "Article du guide", suspend: null },
  message: { label: "Message privé", suspend: null },
};

export const REPORT_STATUSES = {
  open: { label: "Nouveau", tone: "info" },
  reviewing: { label: "En cours d’examen", tone: "warning" },
  resolved: { label: "Traité", tone: "success" },
  dismissed: { label: "Classé sans suite", tone: "neutral" },
} as const;

export const REPORT_DECISIONS = ["examen", "sans_suite", "resolu", "suspendre"] as const;
export type ReportDecision = (typeof REPORT_DECISIONS)[number];

export interface ReportTarget {
  type: ReportTargetType;
  slug: string | null;
  parentType: string | null;
  parentSlug: string | null;
}

const ITEM_STATES: Record<string, string> = { visible: "Visible", hidden: "Masqué", deleted: "Supprimé", verified: "Vérifié" };

/** État lisible d'un contenu (statut de publication, de commentaire ou d'avis). */
export function stateLabel(state: string | null): string | null {
  if (!state) return null;
  if (state in CONTENT_STATUS_META) return CONTENT_STATUS_META[state as ContentStatus].label;
  return ITEM_STATES[state] ?? state;
}

/** Lien public vers le contenu signalé (aucun pour un message privé). */
export function reportTargetHref({ type, slug, parentType, parentSlug }: ReportTarget): string | null {
  if (type === "listing" && slug) return href("listingDetail", { params: { slug } });
  if (type === "place" && slug) return href("placeDetail", { params: { slug } });
  if (type === "event" && slug) return href("eventDetail", { params: { slug } });
  if (type === "business" && slug) return href("professionalDetail", { params: { slug } });
  if (type === "comment" && parentSlug) return href("listingDetail", { params: { slug: parentSlug } });
  if (type === "review" && parentSlug) return href(parentType === "place" ? "placeDetail" : "professionalDetail", { params: { slug: parentSlug } });
  if (type === "article" && slug && parentSlug) return href("guideArticle", { params: { rubrique: parentSlug, article: slug } });
  return null;
}

/** Table de l'historique (content_revisions.entity_type) de chaque type de contenu. */
export const ENTITY_TABLES: Record<string, string> = {
  listing: "listings",
  place: "places",
  event: "events",
  business: "business_profiles",
  neighborhood: "neighborhoods",
  comment: "listing_comments",
  review: "reviews",
  article: "guide_articles",
};

export function historyHref(type: string, id: string): string | null {
  const table = ENTITY_TABLES[type];
  return table ? href("adminAudit", { query: { type: table, id } }) : null;
}

// -----------------------------------------------------------------------------
// Qualité des données
// -----------------------------------------------------------------------------
export const QUALITY_KINDS = {
  expirees: { label: "Expirées", explain: "Annonces arrivées à échéance, ou encore publiées après leur date de fin : à archiver ou à faire reconfirmer." },
  sans_source: { label: "Sans source", explain: "Lieux et événements publiés sans source enregistrée : impossible de dire d’où vient l’information." },
  a_revalider: { label: "À revalider", explain: "Données vérifiées il y a plus de 12 mois (réglable) : à contrôler de nouveau sur le terrain." },
  signales: { label: "Signalées", explain: "Contenus visés par au moins un signalement ouvert, du plus signalé au moins signalé." },
} as const;
export type QualityKind = keyof typeof QUALITY_KINDS;

export function isQualityKind(value: unknown): value is QualityKind {
  return typeof value === "string" && value in QUALITY_KINDS;
}

export const ENTITY_LABELS: Record<string, string> = {
  ...Object.fromEntries(REPORT_TARGET_TYPES.map((type) => [type, REPORT_TARGETS[type].label])),
  neighborhood: "Quartier",
};

export function contentHref(type: string, slug: string | null): string | null {
  if (!slug) return null;
  if (type === "neighborhood") return href("adminNeighborhood", { params: { slug } });
  return reportTargetHref({ type: type as ReportTargetType, slug, parentType: null, parentSlug: null });
}

// -----------------------------------------------------------------------------
// Journal et historique
// -----------------------------------------------------------------------------
const AUDIT_ACTIONS: Record<string, string> = {
  "compte.role": "Rôle d’un compte modifié",
  "compte.suspension": "Compte suspendu",
  "compte.reactivation": "Suspension de compte levée",
  "organisation.suspension": "Organisation suspendue",
  "organisation.reactivation": "Suspension d’organisation levée",
  "signalement.examen": "Signalement pris en charge",
  "signalement.sans_suite": "Signalement classé sans suite",
  "signalement.resolu": "Signalement traité",
  "signalement.suspendre": "Contenu suspendu après signalement",
  "lieu.fusion": "Doublons de lieux fusionnés",
  "campagne.statut": "Statut d’une campagne modifié",
  "ia.arret": "IA coupée (interrupteur général)",
  "ia.reprise": "IA réactivée",
  "business.verify": "Page professionnelle vérifiée",
  "business.verify_reject": "Vérification de page refusée",
  "business_claim.approve": "Revendication de page acceptée",
  "business_claim.reject": "Revendication de page refusée",
  "place_claim.approve": "Revendication de vitrine acceptée",
  "place_claim.reject": "Revendication de vitrine refusée",
  "neighborhood_boundary.propose": "Périmètre de quartier proposé",
  "neighborhood_boundary.validate": "Périmètre de quartier validé",
  "neighborhood_boundary.reject": "Périmètre de quartier refusé",
  "neighborhood_boundary.clear": "Périmètre de quartier retiré",
  "account.become_professional": "Passage en compte professionnel",
  "account.become_individual": "Retour en compte particulier",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTIONS[action] ?? action;
}

export const AUDIT_FILTERS = [
  { value: "", label: "Toutes les actions" },
  { value: "compte.", label: "Comptes" },
  { value: "organisation.", label: "Organisations" },
  { value: "signalement.", label: "Signalements" },
  { value: "lieu.", label: "Fusions de lieux" },
  { value: "campagne.", label: "Campagnes" },
  { value: "ia.", label: "Intelligence artificielle" },
] as const;

/** Champs sans intérêt pour la relecture (techniques ou recalculés). */
const NOISE = new Set(["updated_at", "search_vector", "location", "location_public", "view_count", "created_at"]);

const FIELD_LABELS: Record<string, string> = {
  status: "Statut",
  rejection_reason: "Motif",
  title: "Titre",
  name: "Nom",
  description: "Description",
  summary: "Résumé",
  body: "Texte",
  price: "Prix",
  verification_status: "Vérification",
  verification_note: "Note de vérification",
  verified_at: "Vérifié le",
  source_id: "Source",
  merged_into: "Fusionné dans",
  hidden_reason: "Motif du masquage",
  is_suspended: "Suspendu",
  role: "Rôle",
  published_at: "Publié le",
  expires_at: "Expire le",
  phone: "Téléphone",
  address_text: "Adresse",
  opening_hours: "Horaires",
  resolution_note: "Décision",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 159)}…` : text;
}

export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

/** Champs modifiés entre deux états d'un contenu, lisibles par l'équipe. */
export function revisionChanges(before: unknown, after: unknown): FieldChange[] {
  const left = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const right = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const fields = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((field) => !NOISE.has(field));
  return fields
    .filter((field) => JSON.stringify(left[field] ?? null) !== JSON.stringify(right[field] ?? null))
    .map((field) => ({ field, label: fieldLabel(field), before: display(left[field]), after: display(right[field]) }));
}

// -----------------------------------------------------------------------------
// Mises en avant et abonnements
// -----------------------------------------------------------------------------
export const CAMPAIGN_STATUSES = {
  draft: "Brouillon",
  pending_payment: "En attente de paiement",
  active: "Active",
  paused: "En pause",
  ended: "Terminée",
  rejected: "Refusée",
} as const;

export const CAMPAIGN_DECISIONS = {
  paused: "Mettre en pause",
  ended: "Arrêter",
  rejected: "Refuser",
} as const;
export type CampaignDecision = keyof typeof CAMPAIGN_DECISIONS;

export const SUBSCRIPTION_STATUSES = {
  pending: "En attente",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Résilié",
  expired: "Expiré",
} as const;

export const PLACEMENTS = { home: "Accueil", search: "Recherche", category: "Catégorie", map: "Carte" } as const;
