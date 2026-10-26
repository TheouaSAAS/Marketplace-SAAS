import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Search, SearchX } from "lucide-react";
import { href } from "@/config/routes";
import { listMetadata } from "@/lib/seo";
import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { ListingCard } from "@/components/content/content-cards";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { FilterBar } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/form-controls";
import { PageNav } from "@/components/ui/page-nav";
import { Skeleton } from "@/components/ui/spinner";
import { BrowseFilters } from "@/modules/listings/components/browse-filters";
import { FavoriteButton } from "@/modules/listings/components/listing-buttons";
import { LiveListings } from "@/modules/listings/components/live-listings";
import { isFeatureEnabled } from "@/server/features";
import { browseQuery, BROWSE_PAGE_SIZE, parseBrowseParams, type BrowseParams } from "@/modules/listings/domain/browse";
import { loadBrowsePage } from "@/modules/listings/server/browse";
import { listCategories } from "@/server/repositories/categories";

type Props = PageProps<"/annonces">;

const TITLE = "Toutes les annonces";
const DESCRIPTION = "Biens et objets, véhicules, logements et autres annonces publiées à San Pedro, avec filtres par rubrique, quartier, prix et état.";

const CHIP = "inline-flex h-11 shrink-0 items-center rounded-pill border px-4 text-sm font-semibold transition-colors";

function listHref(params: BrowseParams, overrides: Partial<BrowseParams> = {}): string {
  const query = browseQuery(params, overrides);
  return query ? `${href("listings")}?${query}` : href("listings");
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = await searchParams;
  const slug = parseBrowseParams(raw).categorie;
  const category = slug ? (await listCategories().catch(() => [])).find((item) => item.slug === slug) : undefined;
  return listMetadata({
    title: category ? `${category.name} : annonces à San Pedro` : TITLE,
    description: category?.description ?? DESCRIPTION,
    path: href("listings"),
    searchParams: raw,
    keep: ["categorie"],
  });
}

async function Results({ searchParams }: { searchParams: Props["searchParams"] }) {
  const data = await loadBrowsePage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("listings")}?${data.query}` : href("listings"));
  if (data.kind === "unconfigured" || data.kind === "error") {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: TITLE }]} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">{TITLE}</h1>
        {data.kind === "unconfigured" ? (
          <Alert tone="warning" title="Annonces indisponibles">
            La base de contenus n’est pas encore configurée.
          </Alert>
        ) : (
          <ErrorState title="Les annonces sont momentanément indisponibles" description="Réessayez dans quelques instants." />
        )}
      </div>
    );
  }

  const { params, category, path, total, items } = data;
  const current = listHref(params);
  const parent = path.length > 1 ? path[path.length - 2] : undefined;
  const chips = category ? data.children : data.roots;
  const realEstate = path[0]?.slug === "immobilier";
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: TITLE, href: category ? listHref(params, { categorie: null, attributes: {}, page: 1 }) : undefined },
          ...path.map((item, index): Crumb => ({
            label: item.name,
            href: index < path.length - 1 ? listHref(params, { categorie: item.slug, attributes: {}, page: 1 }) : undefined,
          })),
        ]}
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{category ? category.name : TITLE}</h1>
        <p className="max-w-2xl text-ink-muted">{category?.description ?? DESCRIPTION}</p>
      </div>

      <Form action={href("listings")} role="search" className="flex max-w-2xl gap-2">
        {params.categorie && <input type="hidden" name="categorie" value={params.categorie} />}
        <label htmlFor="annonces-q" className="sr-only">
          Mots-clés
        </label>
        <Input id="annonces-q" name="q" type="search" defaultValue={params.q} maxLength={120} placeholder="Ex. : réfrigérateur, Toyota, matelas…" className="flex-1" />
        <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          <Search aria-hidden className="h-4 w-4" />
          Rechercher
        </button>
      </Form>

      {(chips.length > 0 || parent) && (
        <FilterBar label={category ? `Sous-rubriques de ${category.name}` : "Rubriques"}>
          {category && (
            <Link href={listHref(params, { categorie: parent?.slug ?? null, attributes: {}, page: 1 })} className={`${CHIP} border-border-strong bg-surface hover:bg-sand-100`}>
              ← {parent ? parent.name : "Toutes les rubriques"}
            </Link>
          )}
          {chips.map((item) => (
            <Link key={item.id} href={listHref(params, { categorie: item.slug, attributes: {}, page: 1 })} className={`${CHIP} border-border-strong bg-surface hover:bg-sand-100`}>
              {item.name}
            </Link>
          ))}
        </FilterBar>
      )}

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner la recherche">
          {/* Clé : le formulaire se recrée quand les critères changent (champs non contrôlés). */}
          <BrowseFilters key={current} params={params} categories={data.allCategories} cities={data.cities} neighborhoods={data.neighborhoods} filters={data.filters} />
        </aside>
        <section aria-labelledby="resultats" className="flex min-w-0 flex-col gap-4">
          {/* Statut du direct sur sa propre ligne au téléphone : son libellé change sans déplacer la liste. */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 id="resultats" className="text-xl font-bold">
              {total === 0 ? "Aucune annonce" : `${total} annonce${total > 1 ? "s" : ""}`}
              {data.cityName && ` · ${data.cityName}`}
            </h2>
            <LiveListings enabled={isFeatureEnabled("live_updates")} />
          </div>
          <p className="text-sm text-ink-muted">
            Prix, état et disponibilité sont déclarés par les annonceurs : la plateforme ne les vérifie pas, sauf mention « Vérifié ». Ne versez jamais
            d’argent avant d’avoir vu le bien.
          </p>
          {realEstate && (
            <p className="text-sm">
              Pour un logement,{" "}
              <Link href={href("realEstate")} className="font-semibold text-brand-700 underline">
                la recherche immobilière
              </Link>{" "}
              propose des filtres dédiés (pièces, surface, équipements).
            </p>
          )}
          {total === 0 ? (
            <EmptyState
              icon={<SearchX aria-hidden className="h-6 w-6" />}
              title="Aucune annonce ne correspond à ces critères"
              description="La plateforme démarre : peu d’annonces sont encore publiées. Retirez un filtre, élargissez le prix ou revenez plus tard."
              action={
                <Link href={listHref(parseBrowseParams({}), { categorie: params.categorie })} className="font-semibold text-brand-700 underline">
                  Retirer les filtres
                </Link>
              }
            />
          ) : (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Annonces">
                {items.map((listing, index) => (
                  <li key={listing.id} className="flex [&>article]:flex-1">
                    <ListingCard
                      listing={listing}
                      now={now}
                      index={index}
                      href={href("listingDetail", { params: { slug: listing.slug } })}
                      action={<FavoriteButton listingId={listing.id} active={data.favoriteIds.has(listing.id)} back={current} title={listing.title} />}
                    />
                  </li>
                ))}
              </ul>
              <PageNav page={params.page} total={total} pageSize={BROWSE_PAGE_SIZE} hrefFor={(page) => listHref(params, { page })} />
            </>
          )}
          <p className="text-sm text-ink-muted">
            Les offres d’emploi ont leur propre rubrique :{" "}
            <Link href={href("jobs")} className="font-semibold text-brand-700 underline">
              Emploi et opportunités
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

export default function ListingsPage({ searchParams }: Props) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      {/* Au moins un écran : le pied de page ne saute pas quand les résultats arrivent. */}
      <Suspense fallback={<Skeleton className="min-h-svh w-full rounded-card" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
