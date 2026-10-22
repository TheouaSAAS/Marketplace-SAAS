/**
 * Ressources du site liées à une rubrique du guide : chaque catégorie mène à
 * la page qui la présente (services, commerces, tourisme, immobilier), sinon
 * à la recherche. Le lien n'est proposé que si des contenus existent.
 */
import { href, type RouteKey } from "@/config/routes";

interface CategoryRef {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
}

function rootOf(category: CategoryRef, all: readonly CategoryRef[]): CategoryRef {
  let current = category;
  for (let depth = 0; current.parent_id && depth < 5; depth++) {
    const parent = all.find((item) => item.id === current.parent_id);
    if (!parent) break;
    current = parent;
  }
  return current;
}

const TOURISM_ROOTS = ["lieux-a-visiter", "plages-sites-naturels", "restaurants-gastronomie", "hotels-hebergements", "loisirs-activites", "excursions-guides"];

export function resourceHref(category: CategoryRef, all: readonly CategoryRef[]): string {
  const root = rootOf(category, all).slug;
  const page = (key: RouteKey, query: Record<string, string>) => href(key, { query });
  if (category.slug === "immobilier-location") return href("realEstateMode", { params: { mode: "location" } });
  if (category.slug === "immobilier-vente") return href("realEstateMode", { params: { mode: "vente" } });
  if (root === "immobilier") return href("realEstate");
  if (root === "services-professionnels" || root === "transport-livraison") {
    return category.slug === "services-professionnels" ? href("services") : page("services", { metier: category.slug });
  }
  if (root === "commerces-boutiques") return category.slug === root ? href("shops") : page("shops", { type: category.slug });
  if (TOURISM_ROOTS.includes(root)) return page("tourism", { type: root });
  return page("search", { categorie: category.slug });
}
