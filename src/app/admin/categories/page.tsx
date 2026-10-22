import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CATEGORY_FAMILY_LABELS, categoryForest, type AdminCategory } from "@/modules/admin/domain/categories";
import { CategoryCreateForm, CategoryEditForm } from "@/modules/admin/components/category-forms";
import { listAllCategories } from "@/modules/admin/server/categories";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Catégories — administration",
  robots: { index: false, follow: false },
};

const INDENT = ["", "ml-4 sm:ml-8", "ml-8 sm:ml-16"];

function CategoryRow({ category, depth }: { category: AdminCategory; depth: number }) {
  return (
    <li className={cn("rounded-card border border-border bg-surface", INDENT[Math.min(depth, 2)])}>
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold">{category.name}</span>
          <code className="text-xs text-ink-muted">{category.slug}</code>
          {!category.is_active && <Badge tone="warning">Inactive</Badge>}
          {category.keywords.length > 0 && (
            <span className="text-xs text-ink-muted">
              {category.keywords.length} mot{category.keywords.length > 1 ? "s" : ""}-clé{category.keywords.length > 1 ? "s" : ""}
            </span>
          )}
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <CategoryEditForm category={category} />
          {depth < 2 && (
            <details className="rounded-control bg-surface-muted p-3">
              <summary className="cursor-pointer text-sm font-semibold">Ajouter une sous-catégorie</summary>
              <div className="mt-3">
                <CategoryCreateForm parent={category} />
              </div>
            </details>
          )}
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
  try {
    categories = await listAllCategories();
  } catch (error) {
    logger.error("Lecture du référentiel impossible", { module: "admin", error });
    return <ErrorState title="Référentiel momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-3xl text-sm text-ink-muted">
        Métiers, rubriques et types de commerces. Chaque modification est historisée en base et s’applique aussitôt aux menus, filtres et à la
        recherche en langage courant. Une catégorie ne se supprime pas : désactivez-la.
      </p>
      {categoryForest(categories).map(({ family, nodes }) => (
        <section key={family} aria-labelledby={`famille-${family}`} className="flex flex-col gap-3">
          <h2 id={`famille-${family}`} className="text-xl font-bold">
            {CATEGORY_FAMILY_LABELS[family]}
          </h2>
          <ul className="flex flex-col gap-2">
            {nodes.map(({ category, depth }) => (
              <CategoryRow key={category.id} category={category} depth={depth} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function AdminCategoriesPage() {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mon profil", href: href("profile") }, { label: "Catégories" }]} />
      <h1 className="text-3xl font-extrabold">Catégories</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CategoriesContent />
      </Suspense>
    </Container>
  );
}
