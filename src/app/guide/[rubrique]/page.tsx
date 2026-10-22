import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { GuideCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SectionResources } from "@/modules/guide/components/section-resources";
import { GUIDE_DISCLAIMER } from "@/modules/guide/domain/trust";
import { listGuideArticlesBySection, listGuideSections } from "@/modules/guide/server/queries";
import { getCityContext } from "@/server/city-context";

type Props = PageProps<"/guide/[rubrique]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubrique } = await params;
  const section = (await listGuideSections()).find((item) => item.slug === rubrique);
  if (!section) return { title: "Guide pratique", robots: { index: false, follow: true } };
  return { title: `${section.name} — Guide pratique de San Pedro`, description: section.description ?? undefined };
}

async function Section({ params }: Pick<Props, "params">) {
  const { rubrique } = await params;
  const sections = await listGuideSections();
  const section = sections.find((item) => item.slug === rubrique);
  if (!section) notFound();
  await connection();
  const { current } = await getCityContext();
  const now = new Date();
  const articles = current.id ? await listGuideArticlesBySection(current.id, section.slug, 30) : [];
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Guide pratique", href: href("guide") }, { label: section.name }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{section.name}</h1>
        {section.description && <p className="max-w-2xl text-ink-muted">{section.description}</p>}
      </div>
      {!current.id && <Alert tone="warning" title="Guide indisponible">La base de contenus n’est pas encore configurée.</Alert>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section aria-labelledby="articles" className="flex flex-col gap-3">
          <h2 id="articles" className="text-xl font-bold">
            Articles
          </h2>
          {articles.length === 0 ? (
            <EmptyState
              title="Articles en préparation"
              description="L’équipe locale rédige et vérifie cette rubrique. En attendant, les ressources du site ci-contre et la recherche peuvent vous aider."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {articles.map((article, index) => (
                <li key={article.id} className="flex [&>article]:flex-1">
                  <GuideCard article={article} now={now} index={index} href={href("guideArticle", { params: { rubrique: section.slug, article: article.slug } })} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-4" aria-label="Pour aller plus loin">
          {current.id && (
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <SectionResources section={section} cityId={current.id} />
            </Suspense>
          )}
          <nav aria-label="Autres rubriques" className="rounded-card border border-border bg-surface p-4">
            <h2 className="mb-2 text-lg font-bold">Autres rubriques</h2>
            <ul className="flex flex-col text-sm">
              {sections
                .filter((item) => item.id !== section.id)
                .map((item) => (
                  <li key={item.id}>
                    <Link href={href("guideSection", { params: { rubrique: item.slug } })} className="inline-flex min-h-9 items-center text-brand-700 hover:underline">
                      {item.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </aside>
      </div>
      <p className="max-w-2xl text-xs text-ink-subtle">{GUIDE_DISCLAIMER}</p>
    </div>
  );
}

export default function GuideSectionPage({ params }: Props) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Section params={params} />
      </Suspense>
    </Container>
  );
}
