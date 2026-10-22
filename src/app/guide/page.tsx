import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookOpen, Search } from "lucide-react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { CategoryVisual } from "@/components/content/category-visual";
import { GuideCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GUIDE_DISCLAIMER } from "@/modules/guide/domain/trust";
import { countGuideArticles, listGuideSections, searchGuide } from "@/modules/guide/server/queries";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Guide pratique de San Pedro",
  description: "S’installer, se loger, se déplacer, se soigner, faire ses courses : articles datés et sourcés, rédigés par l’équipe locale.",
};

type Raw = Record<string, string | string[] | undefined>;

async function GuideContent({ searchParams }: { searchParams: Promise<Raw> }) {
  await connection();
  const raw = (await searchParams).q;
  const query = (typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim().slice(0, 120);
  const { current } = await getCityContext();
  if (!current.id) return <Alert tone="warning" title="Guide indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  const now = new Date();
  let loaded: [Awaited<ReturnType<typeof listGuideSections>>, Awaited<ReturnType<typeof countGuideArticles>>, Awaited<ReturnType<typeof searchGuide>> | null];
  try {
    loaded = await Promise.all([listGuideSections(), countGuideArticles(current.id), query ? searchGuide(current.id, query) : Promise.resolve(null)]);
  } catch (error) {
    logger.error("Guide indisponible", { module: "guide", error });
    return <ErrorState title="Le guide est momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const [sections, counts, results] = loaded;
  return (
    <div className="flex flex-col gap-8">
      <Form action={href("guide")} role="search" className="flex w-full max-w-3xl gap-2">
        <label htmlFor="guide-q" className="sr-only">
          Rechercher dans le guide
        </label>
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
          <input
            id="guide-q"
            name="q"
            type="search"
            defaultValue={query}
            maxLength={120}
            placeholder="Ex. ouvrir un compte, pharmacie de garde"
            className="h-12 w-full rounded-pill border border-border-strong bg-surface pl-10 pr-4 text-base placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </div>
        <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Rechercher
        </button>
      </Form>

      {results && (
        <section aria-labelledby="resultats" className="flex flex-col gap-3">
          <h2 id="resultats" className="text-xl font-bold">
            {results.total} article{results.total > 1 ? "s" : ""} pour « {query} »
          </h2>
          {results.items.length === 0 ? (
            <EmptyState
              title="Aucun article ne correspond"
              description="Le guide s’étoffe au fil des vérifications. Essayez d’autres mots, ou cherchez dans tout le site."
              action={
                <Link className="font-semibold underline" href={href("search", { query: { q: query } })}>
                  Rechercher « {query} » dans tout le site
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.items.map((article, index) => (
                <li key={article.id} className="flex [&>article]:flex-1">
                  <GuideCard
                    article={article}
                    now={now}
                    index={index}
                    href={article.section ? href("guideArticle", { params: { rubrique: article.section.slug, article: article.slug } }) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <nav aria-labelledby="rubriques" className="flex flex-col gap-3">
        <h2 id="rubriques" className="text-xl font-bold">
          Rubriques
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const count = counts.get(section.slug) ?? 0;
            return (
              <li key={section.id}>
                <Link
                  href={href("guideSection", { params: { rubrique: section.slug } })}
                  className="flex h-full items-start gap-3 overflow-hidden rounded-card border border-border bg-surface pr-4 hover:border-brand-300"
                >
                  <span className="w-20 shrink-0 self-stretch">
                    <CategoryVisual icon={section.icon} fallback={BookOpen} tone="sand" className="h-full" />
                  </span>
                  <span className="flex flex-col gap-1 py-3">
                    <span className="font-bold">{section.name}</span>
                    {section.description && <span className="text-sm text-ink-muted">{section.description}</span>}
                    <span className="text-xs text-ink-subtle">{count > 0 ? `${count} article${count > 1 ? "s" : ""}` : "Articles en préparation"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default function GuidePage({ searchParams }: PageProps<"/guide">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Guide pratique" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Guide pratique de San Pedro</h1>
        <p className="max-w-2xl text-ink-muted">
          Vivre, se déplacer et s’orienter : des articles rédigés par l’équipe locale, chacun avec sa source et sa date de vérification. Un article non
          vérifié est signalé comme tel.
        </p>
        <p className="max-w-2xl text-xs text-ink-subtle">{GUIDE_DISCLAIMER}</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <GuideContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
