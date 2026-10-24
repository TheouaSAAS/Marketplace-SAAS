import type { Metadata } from "next";
import { detailMetadata } from "@/lib/seo";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Clock } from "lucide-react";
import { href } from "@/config/routes";
import { formatDate } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { VerificationBadge } from "@/components/ui/verification";
import { GuideCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { displayedVerification } from "@/domain/verification";
import { ReportForm } from "@/modules/listings/components/report-form";
import { ArticleBody, TableOfContents } from "@/modules/guide/components/article-body";
import { SectionResources } from "@/modules/guide/components/section-resources";
import { SuggestionForm } from "@/modules/guide/components/suggestion-form";
import { parseMarkdown, readingMinutes, tableOfContents } from "@/modules/guide/domain/markdown";
import { articleTrust, GUIDE_DISCLAIMER, TRUST_NOTICES } from "@/modules/guide/domain/trust";
import { getArticleProvenance, getGuideArticle, listGuideArticlesBySection, listGuideSections, type GuideArticle } from "@/modules/guide/server/queries";
import { getCityContext } from "@/server/city-context";

type Props = PageProps<"/guide/[rubrique]/[article]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubrique, article: slug } = await params;
  const article = await getGuideArticle(slug);
  if (!article) return { title: "Guide pratique", robots: { index: false, follow: true } };
  return detailMetadata({
    title: article.title,
    description: article.summary,
    path: href("guideArticle", { params: { rubrique, article: slug } }),
    noindex: article.verification_status === "placeholder",
    type: "article",
  });
}

async function Provenance({ article }: { article: GuideArticle }) {
  const { credits, history } = await getArticleProvenance(article.id);
  return (
    <section aria-labelledby="provenance" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-sm">
      <h2 id="provenance" className="text-lg font-bold">
        Source et versions
      </h2>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="text-ink-muted">Rédaction</dt>
        <dd>{credits?.author_name ?? "Équipe locale"}</dd>
        <dt className="text-ink-muted">Source</dt>
        <dd className={credits?.source_title ? undefined : "italic text-ink-muted"}>
          {credits?.source_title ? (
            <>
              {credits.source_url ? (
                <a href={credits.source_url} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                  {credits.source_title}
                </a>
              ) : (
                credits.source_title
              )}
              {credits.source_publisher ? ` (${credits.source_publisher})` : ""}
              {credits.source_collected_at ? `, consultée le ${formatDate(credits.source_collected_at)}` : ""}
            </>
          ) : (
            "Information à confirmer localement"
          )}
        </dd>
        <dt className="text-ink-muted">Vérification</dt>
        <dd className={article.verified_at ? undefined : "italic text-ink-muted"}>
          {article.verified_at
            ? `Le ${formatDate(article.verified_at)}${credits?.verifier_name ? ` par ${credits.verifier_name}` : ""}`
            : "Pas encore vérifié par l’équipe locale"}
        </dd>
        <dt className="text-ink-muted">Version</dt>
        <dd>
          {article.version}, mise à jour le {formatDate(article.updated_at)}
        </dd>
      </dl>
      {history.length > 1 && (
        <details>
          <summary className="inline-flex min-h-9 cursor-pointer items-center font-medium">Historique des modifications</summary>
          <ol className="mt-1 flex flex-col gap-1">
            {history.map((entry) => (
              <li key={entry.version}>
                Version {entry.version} · {formatDate(entry.created_at)}
                {entry.change_note ? ` — ${entry.change_note}` : ""}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

async function Related({ article, cityId }: { article: GuideArticle; cityId: string }) {
  const now = new Date();
  const others = (await listGuideArticlesBySection(cityId, article.section.slug, 4)).filter((item) => item.id !== article.id).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="lies" className="flex flex-col gap-3">
      <h2 id="lies" className="text-xl font-bold">
        Dans la même rubrique
      </h2>
      <ul className="grid gap-4 sm:grid-cols-3">
        {others.map((item, index) => (
          <li key={item.id} className="flex [&>article]:flex-1">
            <GuideCard article={item} now={now} index={index} href={href("guideArticle", { params: { rubrique: article.section.slug, article: item.slug } })} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Article({ params }: Pick<Props, "params">) {
  const { rubrique, article: slug } = await params;
  const article = await getGuideArticle(slug);
  if (!article) notFound();
  // Adresse canonique : l'article vit dans sa rubrique.
  if (article.section.slug !== rubrique) redirect(href("guideArticle", { params: { rubrique: article.section.slug, article: slug } }));
  await connection();
  const now = new Date();
  const [sections, { current }] = await Promise.all([listGuideSections(), getCityContext()]);
  const section = sections.find((item) => item.slug === article.section.slug);
  const blocks = parseMarkdown(article.body);
  const trust = articleTrust(article.verification_status, article.verified_at, now);
  const notice = TRUST_NOTICES[trust.kind];
  const back = href("guideArticle", { params: { rubrique: article.section.slug, article: slug } });

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Guide pratique", href: href("guide") },
          { label: article.section.name, href: href("guideSection", { params: { rubrique: article.section.slug } }) },
          { label: article.title },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <article className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-2">
            <VerificationBadge status={displayedVerification(article.verification_status, article.verified_at, now)} />
            <h1 className="text-2xl font-extrabold sm:text-3xl">{article.title}</h1>
            {article.summary && <p className="text-lg text-ink-muted">{article.summary}</p>}
            <p className="flex items-center gap-1.5 text-sm text-ink-subtle">
              <Clock aria-hidden className="h-4 w-4" />
              {readingMinutes(article.body)} min de lecture · mis à jour le {formatDate(article.updated_at)}
            </p>
          </header>
          <Alert tone={notice.tone} title={notice.title}>
            {notice.body}
            {trust.kind === "verified" || trust.kind === "stale" ? ` Dernière vérification : ${formatDate(trust.verifiedAt)}.` : ""}
          </Alert>
          <div className="lg:hidden">
            <TableOfContents entries={tableOfContents(blocks)} />
          </div>
          <ArticleBody blocks={blocks} />
          <p className="max-w-prose rounded-card bg-surface-muted p-3 text-xs text-ink-muted">{GUIDE_DISCLAIMER}</p>
          <Suspense fallback={<Skeleton className="h-32 w-full" />}>
            <Provenance article={article} />
          </Suspense>
          <SuggestionForm articleId={article.id} back={back} />
          <ReportForm target={{ article: article.id }} back={back} label="Signaler cet article" />
        </article>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Dans cet article">
          <div className="hidden lg:block">
            <TableOfContents entries={tableOfContents(blocks)} />
          </div>
          {section && current.id && (
            <Suspense fallback={<Skeleton className="h-32 w-full" />}>
              <SectionResources section={section} cityId={current.id} />
            </Suspense>
          )}
        </aside>
      </div>
      {current.id && (
        <Suspense fallback={null}>
          <Related article={article} cityId={current.id} />
        </Suspense>
      )}
    </div>
  );
}

export default function GuideArticlePage({ params }: Props) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Article params={params} />
      </Suspense>
    </Container>
  );
}
