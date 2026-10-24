import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Briefcase, CalendarDays, Search, Sparkles } from "lucide-react";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { suggestCategories } from "@/modules/publishing/domain/assistant";
import { LISTING_RULES } from "@/modules/publishing/domain/rules";
import { startDraftAction } from "@/modules/publishing/server/actions";
import { getManageablePage } from "@/modules/businesses/server/workspace";
import { listMyListings, publishableCategories, type CategoryGroup, type PublishableCategory } from "@/modules/publishing/server/queries";
import { getCurrentAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Publier une annonce",
  description: "Publiez gratuitement une annonce à San Pedro : formulaire guidé selon la catégorie, brouillon enregistré, relecture par l’équipe avant mise en ligne.",
};

type Raw = Record<string, string | string[] | undefined>;

function CategoryButton({ category, text, highlight, pageId }: { category: PublishableCategory; text?: string; highlight?: string; pageId?: string }) {
  return (
    <form action={startDraftAction}>
      <input type="hidden" name="categorie" value={category.id} />
      {text && <input type="hidden" name="texte" value={text} />}
      {pageId && <input type="hidden" name="page" value={pageId} />}
      <button
        type="submit"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-control border border-border bg-surface px-3 py-2 text-left text-sm font-semibold hover:border-brand-600 hover:bg-sand-100"
      >
        <span>
          {category.name}
          {highlight && <span className="block text-xs font-normal text-ink-muted">{highlight}</span>}
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink-subtle" />
      </button>
    </form>
  );
}

/** Choix de la catégorie : suggestions d'après une description libre, puis la liste complète. */
async function Categories({ searchParams }: { searchParams: Promise<Raw> }) {
  const raw = await searchParams;
  const text = typeof raw.q === "string" ? raw.q.trim().slice(0, 500) : "";
  let groups: CategoryGroup[];
  let flat: PublishableCategory[];
  try {
    ({ groups, flat } = await publishableCategories());
  } catch (error) {
    logger.error("Catégories indisponibles", { module: "publication", error });
    return <ErrorState title="Catégories momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  if (flat.length === 0) return <ErrorState title="Publication indisponible" description="Aucune catégorie n’est ouverte à la publication pour l’instant." />;
  const suggested = text ? suggestCategories(text, flat) : [];
  const page = await getManageablePage(typeof raw.page === "string" ? raw.page : undefined).catch(() => null);
  return (
    <div className="flex flex-col gap-8">
      {page && <Alert tone="info">Annonce publiée au nom de la page « {page.name} » : visible de son équipe dans l’espace professionnel.</Alert>}
      {raw.limite === "1" && <Alert tone="warning">Vous avez créé beaucoup de brouillons aujourd’hui : terminez ou supprimez-en avant d’en créer d’autres.</Alert>}
      {raw.erreur === "1" && <Alert tone="danger">Le brouillon n’a pas pu être créé. Réessayez.</Alert>}
      <section aria-labelledby="decrire" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-6">
        <h2 id="decrire" className="flex items-center gap-2 text-xl font-bold">
          <Sparkles aria-hidden className="h-5 w-5 text-brand-600" />
          Que voulez-vous publier ?
        </h2>
        <Form action={href("publish")} role="search" aria-label="Décrire votre annonce" className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="decrire-annonce" className="sr-only">
            Décrivez votre annonce en quelques mots
          </label>
          <input
            id="decrire-annonce"
            name="q"
            defaultValue={text}
            maxLength={500}
            placeholder="Ex. : je loue un studio meublé à Bardot"
            className="min-h-11 flex-1 rounded-control border border-border-strong bg-surface px-3 text-base"
          />
          <Button type="submit" icon={<Search aria-hidden className="h-4 w-4" />}>
            Trouver la catégorie
          </Button>
        </Form>
        {text && (
          <div className="flex flex-col gap-2">
            {suggested.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucune catégorie reconnue : choisissez dans la liste ci-dessous.</p>
            ) : (
              <>
                <p className="text-sm text-ink-muted">Catégories proposées (par mots-clés, à vous de choisir) :</p>
                <ul className="grid gap-2 sm:grid-cols-3">
                  {suggested.map((item) => {
                    const category = flat.find((candidate) => candidate.id === item.id)!;
                    return (
                      <li key={item.id}>
                        <CategoryButton category={{ ...category, name: item.name }} text={text} highlight={`Mots reconnus : ${item.matched.join(", ")}`} pageId={page?.id} />
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="toutes" className="flex flex-col gap-4">
        <h2 id="toutes" className="text-xl font-bold">
          Ou choisissez une catégorie
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`rubrique-${group.id}`} className="flex flex-col gap-2">
              <h3 id={`rubrique-${group.id}`} className="font-bold">
                {group.name}
              </h3>
              {group.sections.map((section, index) => (
                <div key={section.name ?? index} className="flex flex-col gap-2">
                  {section.name && <h4 className="text-sm font-semibold text-ink-muted">{section.name}</h4>}
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {section.children.map((category) => (
                      <li key={category.id}>
                        <CategoryButton category={category} text={text || undefined} pageId={page?.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
        <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
          <li>
            <Link href={href("publishJob")} className="inline-flex items-center gap-1.5 font-semibold underline">
              <Briefcase aria-hidden className="h-4 w-4" />
              Offre d’emploi, stage, mission ou opportunité
            </Link>
          </li>
          <li>
            <Link href={href("eventPropose")} className="inline-flex items-center gap-1.5 font-semibold underline">
              <CalendarDays aria-hidden className="h-4 w-4" />
              Proposer un événement
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

/** Brouillons en cours de la personne connectée (rien pour un visiteur). */
async function Drafts() {
  const account = await getCurrentAccount();
  if (!account) return <p className="text-sm text-ink-muted">Connexion requise pour publier : vous pourrez choisir la catégorie juste après.</p>;
  let drafts;
  try {
    drafts = (await listMyListings(account.id)).filter((listing) => listing.status === "draft").slice(0, 5);
  } catch {
    return null;
  }
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby="brouillons" className="flex flex-col gap-2 rounded-card border border-border bg-sand-50 p-4">
      <h2 id="brouillons" className="font-bold">
        Reprendre un brouillon
      </h2>
      <ul className="flex flex-col gap-1 text-sm">
        {drafts.map((draft) => (
          <li key={draft.id}>
            <Link href={href("publishEditor", { params: { id: draft.id } })} className="font-semibold underline">
              {draft.title || `Brouillon sans titre (${draft.category.name})`}
            </Link>
          </li>
        ))}
      </ul>
      <Link href={href("myListings")} className="text-sm underline">
        Toutes mes annonces
      </Link>
    </section>
  );
}

export default function PublishPage({ searchParams }: PageProps<"/publier">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Publier une annonce" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Publier une annonce</h1>
        <p className="max-w-2xl text-ink-muted">
          Gratuit. Le formulaire s’adapte à la catégorie, votre brouillon est enregistré au fur et à mesure, et l’équipe relit chaque annonce avant sa mise en
          ligne. Un assistant peut vous aider à remplir : chaque suggestion reste à valider par vous.
        </p>
      </div>
      <Suspense fallback={null}>
        <Drafts />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Categories searchParams={searchParams} />
      </Suspense>
      <aside aria-labelledby="regles" className="rounded-card border border-border p-4 text-sm">
        <h2 id="regles" className="font-bold">
          Règles de publication
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
          {LISTING_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </aside>
    </Container>
  );
}
