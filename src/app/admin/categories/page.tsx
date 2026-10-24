import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/cn";
import { CATEGORY_ICON_NAMES } from "@/components/content/category-visual";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  CATEGORY_FAMILY_LABELS,
  categoryForest,
  DEPTH_LABELS,
  MAX_CATEGORY_DEPTH,
  moveTargets,
  NO_USAGE,
  replacementTargets,
  usageTotal,
  type AdminCategory,
  type CategoryUsage,
} from "@/modules/admin/domain/categories";
import { CategoryCreateForm, CategoryDeleteForm, CategoryEditForm } from "@/modules/admin/components/category-forms";
import { categoryUsage, listAllCategories } from "@/modules/admin/server/categories";
import { SCHEMA_LABELS } from "@/modules/listings/domain/attributes";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Catégories — administration",
  robots: { index: false, follow: false },
};

const INDENT = ["", "ml-4 sm:ml-8", "ml-8 sm:ml-16", "ml-12 sm:ml-24"];

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function UsageLine({ usage }: { usage: CategoryUsage }) {
  const parts = [
    usage.listingsPublished && count(usage.listingsPublished, "annonce publiée", "annonces publiées"),
    usage.listingsOther && count(usage.listingsOther, "autre annonce (brouillon, retirée…)", "autres annonces (brouillons, retirées…)"),
    usage.places && count(usage.places, "lieu", "lieux"),
    usage.events && count(usage.events, "événement", "événements"),
    usage.businesses && count(usage.businesses, "page pro", "pages pro"),
  ].filter(Boolean);
  return <span className="text-xs text-ink-muted">{parts.length ? parts.join(" · ") : "Aucun contenu"}</span>;
}

function CategoryRow({ all, category, depth, usage }: { all: AdminCategory[]; category: AdminCategory; depth: number; usage: CategoryUsage }) {
  const used = usageTotal(usage);
  return (
    <li className={cn("rounded-card border border-border bg-surface", INDENT[Math.min(depth, 3)])}>
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">{category.name}</span>
          <code className="text-xs text-ink-muted">{category.slug}</code>
          {!category.is_active && <Badge tone="warning">Inactive</Badge>}
          <UsageLine usage={usage} />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            <span>Niveau : {DEPTH_LABELS[depth]}</span>
            <span>Modèle : {category.attribute_schema ? (SCHEMA_LABELS[category.attribute_schema] ?? category.attribute_schema) : "aucun"}</span>
            {category.content_types.includes("listing") && category.is_active && (
              <Link href={href("listings", { query: { categorie: category.slug } })} className="font-semibold text-brand-700 underline">
                Voir les annonces publiées
              </Link>
            )}
          </p>
          <CategoryEditForm category={category} parents={moveTargets(all, category)} icons={CATEGORY_ICON_NAMES} />
          {depth < MAX_CATEGORY_DEPTH - 1 && (
            <details className="rounded-control bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-semibold">Ajouter une sous-catégorie</summary>
              <div className="mt-3">
                <CategoryCreateForm parent={category} family={category.family} depth={depth + 1} icons={CATEGORY_ICON_NAMES} />
              </div>
            </details>
          )}
          <details className="rounded-control bg-surface-muted p-3">
            <summary className="cursor-pointer text-sm font-semibold">Supprimer la catégorie</summary>
            <div className="mt-3">
              {usage.children > 0 ? (
                <p className="text-sm text-ink-muted">
                  Elle contient {count(usage.children, "sous-catégorie", "sous-catégories")} : déplacez-les ou supprimez-les d’abord.
                </p>
              ) : (
                <CategoryDeleteForm category={category} used={used} targets={replacementTargets(all, category)} />
              )}
            </div>
          </details>
        </div>
      </details>
    </li>
  );
}

/** Réservé aux administrateurs : l'interface le vérifie, la base le garantit (règle `categories_admin_write`). */
async function CategoriesContent() {
  const account = await requireAccount(href("adminCategories"));
  if (!isAdmin(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée aux administrateurs de la plateforme.
      </Alert>
    );
  }
  let categories: AdminCategory[];
  let usage: Map<string, CategoryUsage>;
  try {
    [categories, usage] = await Promise.all([listAllCategories(), categoryUsage()]);
  } catch (error) {
    logger.error("Lecture du référentiel impossible", { module: "admin", error });
    return <ErrorState title="Référentiel momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-3xl text-sm text-ink-muted">
        Rubriques, métiers et types de commerces, sur quatre niveaux au plus (rubrique principale, sous-rubrique, sous-catégorie, catégorie
        détaillée). Chaque modification est historisée en base et s’applique aussitôt aux menus, aux filtres, aux formulaires de publication et à
        la recherche. Une catégorie désactivée n’est plus proposée ; ses contenus restent en place.
      </p>
      {categoryForest(categories).map(({ family, nodes }) => (
        <section key={family} aria-labelledby={`famille-${family}`} className="flex flex-col gap-3">
          <h2 id={`famille-${family}`} className="text-xl font-bold">
            {CATEGORY_FAMILY_LABELS[family]}
          </h2>
          <ul className="flex flex-col gap-2">
            {nodes.map(({ category, depth }) => (
              <CategoryRow key={category.id} all={categories} category={category} depth={depth} usage={usage.get(category.id) ?? NO_USAGE} />
            ))}
          </ul>
          <details className="rounded-card border border-dashed border-border-strong p-3">
            <summary className="cursor-pointer text-sm font-semibold">Ajouter une rubrique principale</summary>
            <div className="mt-3">
              <CategoryCreateForm family={family} depth={0} icons={CATEGORY_ICON_NAMES} />
            </div>
          </details>
        </section>
      ))}
    </div>
  );
}

export default function AdminCategoriesPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: "Catégories" }]} />
      <h1 className="text-3xl font-extrabold">Catégories</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CategoriesContent />
      </Suspense>
    </Container>
  );
}
