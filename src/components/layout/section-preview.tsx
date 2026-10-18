import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Check, Construction } from "lucide-react";
import { hasPage, href, ROUTES } from "@/config/routes";
import { SECTION_PREVIEWS, type PreviewSectionKey, type SectionPreviewConfig } from "@/config/sections";
import { listCategories, selectCategoryTree } from "@/server/repositories/categories";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { logger } from "@/lib/logger";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Métadonnées d'une rubrique en préparation : jamais indexée (contenu encore mince). */
export function sectionPreviewMetadata(section: PreviewSectionKey): Metadata {
  const config: SectionPreviewConfig = SECTION_PREVIEWS[section];
  return { title: config.title, description: config.intro, robots: { index: false, follow: true } };
}

function crumbsFor(section: PreviewSectionKey): Crumb[] {
  const config: SectionPreviewConfig = SECTION_PREVIEWS[section];
  const crumbs: Crumb[] = [];
  if (config.parent) crumbs.push({ label: ROUTES[config.parent].label, href: href(config.parent) });
  crumbs.push({ label: config.title });
  return crumbs;
}

/** Catégories réelles de la rubrique (référentiel en base), avec la catégorie choisie en `?categorie=`. */
async function CategoryBlock({ section, searchParams }: { section: PreviewSectionKey; searchParams: SearchParams }) {
  const config: SectionPreviewConfig = SECTION_PREVIEWS[section];
  if (!config.categories?.length) return null;
  const params = await searchParams;
  const selectedSlug = typeof params.categorie === "string" ? params.categorie : undefined;

  let tree: ReturnType<typeof selectCategoryTree> = [];
  try {
    tree = selectCategoryTree(await listCategories(), config.categories);
  } catch (error) {
    logger.warn("Catégories indisponibles", { module: "rubriques", error });
  }
  if (tree.length === 0) return null;

  const selected = tree.flatMap(({ parent, children }) => [parent, ...children]).find((category) => category.slug === selectedSlug);

  return (
    <section aria-labelledby="categories" className="flex flex-col gap-4">
      <h2 id="categories" className="text-xl font-bold">
        Catégories de la rubrique
      </h2>
      {selected && (
        <Alert tone="info" title={`Catégorie : ${selected.name}`}>
          Les contenus de cette catégorie apparaîtront ici dès leur publication et leur vérification.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {tree.map(({ parent, children }) => (
          <Card key={parent.id}>
            <CardBody className="gap-2">
              <Link
                href={href(section, { query: { categorie: parent.slug } })}
                aria-current={parent.slug === selectedSlug ? "true" : undefined}
                className="font-bold hover:text-brand-700 hover:underline aria-[current=true]:text-brand-700"
              >
                {parent.name}
              </Link>
              {children.length > 0 && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={href(section, { query: { categorie: child.slug } })}
                        aria-current={child.slug === selectedSlug ? "true" : undefined}
                        className="text-ink-muted hover:text-brand-700 hover:underline aria-[current=true]:font-semibold aria-[current=true]:text-brand-700"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

/**
 * Écran d'attente d'une rubrique : explique ce qui arrive, sans aucune donnée
 * fictive, et oriente vers ce qui existe déjà.
 */
export function SectionPreview({ section, searchParams }: { section: PreviewSectionKey; searchParams: SearchParams }) {
  const config: SectionPreviewConfig = SECTION_PREVIEWS[section];
  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={crumbsFor(section)} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{config.title}</h1>
          <Badge tone="warning">En préparation</Badge>
        </div>
        <p className="max-w-3xl text-lg text-ink-muted">{config.intro}</p>
      </div>

      <Card>
        <CardBody className="gap-4 sm:flex-row sm:gap-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-warning-soft text-warning">
            <Construction aria-hidden className="h-6 w-6" />
          </span>
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg">Cette rubrique est en cours de construction</CardTitle>
            <p className="text-sm text-ink-muted">
              Aucun contenu n’y est encore publié : nous préférons une page vide à des informations inventées. Voici ce
              que vous y trouverez :
            </p>
            <ul className="flex flex-col gap-2">
              {config.upcoming.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>

      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <CategoryBlock section={section} searchParams={searchParams} />
      </Suspense>

      <section aria-labelledby="voir-aussi" className="flex flex-col gap-3">
        <h2 id="voir-aussi" className="text-xl font-bold">
          Voir aussi
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {config.related.filter(hasPage).map((route) => (
            <li key={route}>
              <Link
                href={href(route)}
                className="flex min-h-14 items-center justify-between gap-2 rounded-card border border-border bg-surface px-4 py-3 font-semibold hover:border-brand-300 hover:text-brand-700"
              >
                {ROUTES[route].label}
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
