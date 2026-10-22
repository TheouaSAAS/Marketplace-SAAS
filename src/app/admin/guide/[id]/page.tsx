import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { isCurator } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SUGGESTION_DECISIONS } from "@/modules/guide/domain/editorial";
import { ArticleEditorForm, SuggestionDecisionForm } from "@/modules/guide/components/editorial-forms";
import { getArticleForEditing, listEditorialSections, listSources } from "@/modules/guide/server/editorial";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Modifier un article du guide — administration",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/admin/guide/[id]">;

const SUGGESTION_LABELS: Record<string, string> = { open: "Nouvelle", ...SUGGESTION_DECISIONS };

async function Editor({ params, searchParams }: Props) {
  const { id } = await params;
  const account = await requireAccount(href("adminGuideArticle", { params: { id } }));
  if (!isCurator(account.role)) {
    return (
      <Alert tone="warning" title="Accès réservé">
        Cette page est réservée à l’équipe locale.
      </Alert>
    );
  }
  const saved = (await searchParams).enregistre === "1";
  let loaded: [Awaited<ReturnType<typeof listEditorialSections>>, Awaited<ReturnType<typeof listSources>>, Awaited<ReturnType<typeof getArticleForEditing>>];
  try {
    loaded = await Promise.all([listEditorialSections(), listSources(), id === "nouveau" ? Promise.resolve(null) : getArticleForEditing(id)]);
  } catch (error) {
    logger.error("Article du guide indisponible", { module: "guide", error });
    return <ErrorState title="Article momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const [sections, sources, editing] = loaded;
  if (id !== "nouveau" && !editing) notFound();
  const article = editing?.article;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-extrabold">{article ? article.title : "Nouvel article"}</h1>
      {saved && (
        <Alert tone="success" title="Enregistré">
          Version {article?.version} enregistrée.
          {article?.status === "published" && (
            <>
              {" "}
              <Link className="underline" href={href("guideArticle", { params: { rubrique: article.section.slug, article: article.slug } })}>
                Voir l’article publié
              </Link>
            </>
          )}
        </Alert>
      )}
      <ArticleEditorForm
        key={`${article?.id ?? "nouveau"}-${article?.version ?? 0}`}
        draft={article ?? {}}
        sections={sections}
        sources={sources}
      />
      {editing && editing.suggestions.length > 0 && (
        <section aria-labelledby="suggestions" className="flex flex-col gap-3">
          <h2 id="suggestions" className="text-xl font-bold">
            Suggestions des lecteurs
          </h2>
          <ul className="flex flex-col gap-3">
            {editing.suggestions.map((suggestion) => (
              <li key={suggestion.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
                <p className="text-xs text-ink-muted">
                  {formatDateTime(suggestion.created_at)} · {SUGGESTION_LABELS[suggestion.status]}
                  {suggestion.resolution_note ? ` · « ${suggestion.resolution_note} »` : ""}
                </p>
                <p className="whitespace-pre-line text-sm">{suggestion.message}</p>
                <SuggestionDecisionForm suggestionId={suggestion.id} articleId={editing.article.id} status={suggestion.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {editing && (
        <section aria-labelledby="versions" className="flex flex-col gap-3">
          <h2 id="versions" className="text-xl font-bold">
            Versions
          </h2>
          <ol className="flex flex-col gap-2">
            {editing.versions.map((version) => (
              <li key={version.version} className="rounded-card border border-border bg-surface p-3 text-sm">
                <details>
                  <summary className="cursor-pointer">
                    Version {version.version} · {formatDateTime(version.created_at)}
                    {version.change_note ? ` — ${version.change_note}` : ""}
                  </summary>
                  <p className="mt-2 font-semibold">{version.title}</p>
                  {version.summary && <p className="text-ink-muted">{version.summary}</p>}
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-control bg-surface-muted p-2 text-xs">{version.body}</pre>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function AdminGuideArticlePage(props: Props) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Guide : rédaction", href: href("adminGuide") }, { label: "Article" }]} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Editor {...props} />
      </Suspense>
    </Container>
  );
}
