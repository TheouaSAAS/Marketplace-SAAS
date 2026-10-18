import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { ArrowRight, Info, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { NAV_SECTIONS, NEWCOMER_LINK } from "@/config/navigation";
import { href } from "@/config/routes";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { logger } from "@/lib/logger";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { getSessionUser } from "@/server/auth";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { resolveSearch } from "../domain/effective";
import { NO_SPONSORING, overviewRule, SORT_RULES, TYPE_DESCRIPTIONS } from "../domain/explanations";
import { interpretQuery, type Interpretation } from "../domain/natural-language";
import {
  activeFilters,
  effectiveSort,
  EMPTY_SEARCH,
  forType,
  PAGE_SIZE,
  parseSearchParams,
  rawQueryString,
  SEARCH_TYPE_KEYS,
  SEARCH_TYPES,
  searchHref,
  SORTS,
  toQueryString,
  withChanges,
  type ActiveFilter,
  type SearchParams,
  type SearchSort,
  type SearchType,
} from "../domain/params";
import { parsePositionCookie, POSITION_COOKIE } from "../domain/position";
import { recordSearch } from "../server/analytics";
import { countByType, getSearchRadiiKm, searchType, type ResolvedSearch, type SearchItem } from "../server/queries";
import { PositionControl } from "./position-control";
import { ResultGrid } from "./result-grid";
import { SaveSearchForm } from "./saved-search-forms";
import { SearchBox } from "./search-box";
import { SearchFilters } from "./search-filters";
import { ActiveFilters, Pagination, SearchTabs } from "./search-navigation";

const SEARCH = href("search");
const log = logger.child({ module: "recherche" });

type RawParams = Record<string, string | string[] | undefined>;

function Rule({ children }: { children: ReactNode }) {
  return (
    <details className="text-sm text-ink-muted">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium hover:text-ink [&::-webkit-details-marker]:hidden">
        <Info aria-hidden className="h-4 w-4" />
        Pourquoi cet ordre ?
      </summary>
      <p className="mt-1 max-w-2xl">{children}</p>
    </details>
  );
}

function InterpretationNotice({
  interpretation,
  rawQuery,
  rawType,
  showPosition,
}: {
  interpretation: Interpretation;
  rawQuery: string;
  rawType: SearchType | null;
  showPosition: boolean;
}) {
  const exact = { ...EMPTY_SEARCH, q: rawQuery, type: rawType, brut: true };
  return (
    <Alert
      tone="info"
      title="Nous avons interprété votre recherche"
      action={
        <div className="flex flex-col gap-3">
          {showPosition && <PositionControl hasPosition={false} />}
          <Link href={searchHref(SEARCH, exact)} className="font-semibold text-brand-800 underline underline-offset-2">
            Rechercher plutôt le texte exact « {rawQuery} »
          </Link>
        </div>
      }
    >
      <ul className="flex flex-wrap gap-1.5" aria-label="Critères compris">
        {interpretation.understood.map((label) => (
          <li key={label} className="rounded-pill bg-white/70 px-2.5 py-0.5 font-medium">
            {label}
          </li>
        ))}
        {interpretation.keywords && (
          <li className="rounded-pill bg-white/70 px-2.5 py-0.5 font-medium">Mots-clés : « {interpretation.keywords} »</li>
        )}
      </ul>
      <p className="mt-1">Règles fixes, sans intelligence artificielle : rien n’est ajouté à ce que vous avez écrit.</p>
    </Alert>
  );
}

function NoResults({
  params,
  filters,
  counts,
  interpreted,
  rawQuery,
}: {
  params: SearchParams;
  filters: ActiveFilter[];
  counts: Record<SearchType, number> | null;
  interpreted: boolean;
  rawQuery: string;
}) {
  const suggestions: { href: string; label: string }[] = [
    ...filters.map((filter) => ({ href: searchHref(SEARCH, filter.without), label: `Retirer « ${filter.label} »` })),
    ...(params.type && counts
      ? SEARCH_TYPE_KEYS.filter((type) => type !== params.type && counts[type] > 0).map((type) => ({
          href: searchHref(SEARCH, forType(params, type)),
          label: `${counts[type]} résultat${counts[type] > 1 ? "s" : ""} dans « ${SEARCH_TYPES[type].label} »`,
        }))
      : []),
    ...(params.type ? [{ href: searchHref(SEARCH, forType(params, null)), label: "Chercher dans tous les types" }] : []),
    ...(interpreted ? [{ href: searchHref(SEARCH, { ...EMPTY_SEARCH, q: rawQuery, brut: true }), label: `Rechercher le texte exact « ${rawQuery} »` }] : []),
    ...(params.q && params.q.includes(" ")
      ? [{ href: searchHref(SEARCH, withChanges(params, { q: params.q.split(" ")[0]! })), label: `Chercher seulement « ${params.q.split(" ")[0]} »` }]
      : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon={<SearchX aria-hidden className="h-6 w-6" />}
        title={params.q ? `Aucun résultat pour « ${params.q} »` : "Aucun résultat avec ces critères"}
        description="La plateforme démarre : de nombreux contenus restent à publier. Élargissez vos critères ou parcourez les rubriques."
      />
      {suggestions.length > 0 && (
        <div>
          <h2 className="mb-2 font-bold">Élargir la recherche</h2>
          <ul className="flex flex-col gap-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.href}>
                <Link href={suggestion.href} className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline">
                  <ArrowRight aria-hidden className="h-4 w-4" />
                  {suggestion.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h2 className="mb-2 font-bold">Parcourir les rubriques</h2>
        <ul className="flex flex-wrap gap-2">
          {[...NAV_SECTIONS.map((section) => ({ label: section.label, route: section.route })), NEWCOMER_LINK].map((item) => (
            <li key={item.label}>
              <Link href={href(item.route)} className="inline-flex min-h-11 items-center rounded-pill border border-border bg-surface px-4 text-sm font-semibold hover:border-brand-300">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Nom proposé pour enregistrer une recherche : texte puis critères principaux. */
function suggestedName(params: SearchParams, filters: ActiveFilter[]): string {
  const parts = [params.q && `« ${params.q} »`, params.type && SEARCH_TYPES[params.type].label, ...filters.slice(0, 2).map((filter) => filter.label)];
  return parts.filter(Boolean).join(" · ").slice(0, 80) || "Ma recherche";
}

export async function SearchContent({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const requested = parseSearchParams(raw);
  // Une seule adresse par recherche : champs vides du formulaire, tri par défaut, valeurs
  // invalides ou paramètres inconnus sont retirés (une redirection, jamais en boucle).
  if (rawQueryString(raw) !== toQueryString(requested)) redirect(searchHref(SEARCH, requested));

  const [{ current }, cookieStore, requestHeaders, user] = await Promise.all([getCityContext(), cookies(), headers(), getSessionUser()]);
  const box = <SearchBox query={requested.q} type={requested.type} />;
  if (!current.id) {
    return (
      <div className="flex flex-col gap-6">
        {box}
        <Alert tone="warning" title="Recherche indisponible">
          La base de contenus n’est pas encore configurée.
        </Alert>
      </div>
    );
  }
  const cityId = current.id;

  const geolocation = isFeatureEnabled("geolocation");
  const position = geolocation ? parsePositionCookie(cookieStore.get(POSITION_COOKIE)?.value) : null;
  const [categories, neighborhoods, radiiKm] = await Promise.all([listCategories(), listNeighborhoods(cityId), getSearchRadiiKm()]);

  const interpretation =
    requested.q && !requested.brut
      ? interpretQuery(requested.q, {
          neighborhoods: neighborhoods.map(({ slug, name }) => ({ slug, name })),
          categorySlugs: new Set(categories.map((category) => category.slug)),
        })
      : null;
  const resolved = resolveSearch(requested, interpretation, position !== null);
  // Catégorie ou quartier inconnus (supprimés, mal saisis) : ignorés.
  const category = resolved.params.categorie ? categories.find((item) => item.slug === resolved.params.categorie) : undefined;
  const neighborhood = resolved.params.quartier ? neighborhoods.find((item) => item.slug === resolved.params.quartier) : undefined;
  const params: SearchParams = { ...resolved.params, categorie: category?.slug ?? null, quartier: neighborhood?.slug ?? null };
  const applied = resolved.interpretation;

  const search: ResolvedSearch = {
    cityId,
    params,
    categoryIds: category ? categoryIdsWithDescendants(categories, [category.slug]) : null,
    neighborhoodId: neighborhood?.id ?? null,
    position,
    now: new Date(),
  };
  const filters = activeFilters(params, { category: category?.name, neighborhood: neighborhood?.name });
  const clearAll = forType({ ...params, quartier: null, verifie: false, rayon: null }, params.type);
  const nearWithoutPosition = Boolean(applied?.near) && !position && geolocation;
  const preferProximity = Boolean(applied?.near) && position !== null;

  let counts: Record<SearchType, number>;
  let page: { sort: SearchSort; total: number; items: SearchItem[] } | null = null;
  let overview: { type: SearchType; total: number; items: SearchItem[] }[] = [];
  try {
    if (params.type) {
      const sort = effectiveSort(params, params.type, position !== null);
      const [allCounts, result] = await Promise.all([
        countByType(search),
        searchType(search, params.type, { sort, limit: PAGE_SIZE, offset: (params.page - 1) * PAGE_SIZE }),
      ]);
      counts = allCounts;
      page = { sort, ...result };
    } else {
      counts = await countByType(search);
      overview = await Promise.all(
        SEARCH_TYPE_KEYS.filter((type) => counts[type] > 0).map(async (type) => ({
          type,
          ...(await searchType(search, type, {
            sort: preferProximity && type !== "guide" ? "proximite" : effectiveSort(params, type, position !== null),
            limit: 3,
            offset: 0,
          })),
        })),
      );
    }
  } catch (error) {
    log.error("Recherche impossible", { error });
    return (
      <div className="flex flex-col gap-6">
        {box}
        <ErrorState
          title="La recherche est momentanément indisponible"
          description="Réessayez dans quelques instants. Vous pouvez aussi parcourir les rubriques depuis le menu."
        />
      </div>
    );
  }

  const total = page ? page.total : SEARCH_TYPE_KEYS.reduce((sum, type) => sum + counts[type], 0);
  // Statistiques anonymes, après la réponse ; jamais pour un préchargement de lien.
  if (!requestHeaders.get("next-router-prefetch")) {
    after(() => recordSearch({ cityId, type: params.type ?? "apercu", query: params.q, results: total }));
  }

  const query = toQueryString(params);
  const canSave = isFeatureEnabled("accounts") && query !== "";
  const pageOutOfRange = page !== null && page.total > 0 && page.items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {box}
      {applied && (
        <InterpretationNotice interpretation={applied} rawQuery={requested.q} rawType={requested.type} showPosition={nearWithoutPosition} />
      )}
      <SearchTabs params={params} counts={counts} activeTotal={page?.total ?? null} />

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" aria-label="Affiner la recherche">
          <SearchFilters
            params={params}
            sort={page?.sort ?? null}
            categories={categories}
            neighborhoods={neighborhoods}
            radiiKm={radiiKm}
            hasPosition={position !== null}
            activeCount={filters.length}
          />
          {geolocation && !nearWithoutPosition && (
            <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <h2 className="font-bold">Autour de moi</h2>
              <PositionControl hasPosition={position !== null} />
            </div>
          )}
        </aside>

        <section aria-labelledby="resultats-titre" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="resultats-titre" className="text-xl font-bold" aria-live="polite">
                {total === 0
                  ? "Aucun résultat"
                  : `${total} résultat${total > 1 ? "s" : ""}${params.type ? ` · ${SEARCH_TYPES[params.type].label}` : ""}${params.q ? ` pour « ${params.q} »` : ""}`}
              </h2>
              {page && total > 0 && (
                <p className="text-sm text-ink-muted">
                  Trié par : {SORTS[page.sort].toLowerCase()} · {current.name}
                </p>
              )}
            </div>
            {canSave && total > 0 && <SaveSearchForm query={query} suggestedName={suggestedName(params, filters)} signedIn={user !== null} />}
          </div>
          <ActiveFilters filters={filters} clearAll={clearAll} />

          {total === 0 ? (
            <NoResults params={params} filters={filters} counts={counts} interpreted={applied !== null} rawQuery={requested.q} />
          ) : page ? (
            <>
              <Rule>
                {SORT_RULES[page.sort]} {NO_SPONSORING}
              </Rule>
              {pageOutOfRange ? (
                <Alert tone="info" title="Cette page n’existe plus">
                  Les résultats ont changé depuis.{" "}
                  <Link href={searchHref(SEARCH, withChanges(params, { page: 1 }))} className="font-semibold underline">
                    Revenir à la première page
                  </Link>
                </Alert>
              ) : (
                <ResultGrid items={page.items} now={search.now} label={`Résultats : ${SEARCH_TYPES[params.type!].label}`} />
              )}
              <Pagination params={params} total={page.total} pageSize={PAGE_SIZE} />
            </>
          ) : (
            <>
              <Rule>
                {overviewRule(Boolean(params.q))} {NO_SPONSORING}
              </Rule>
              {overview.map((group) => (
                <section key={group.type} aria-labelledby={`apercu-${group.type}`} className="flex flex-col gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 id={`apercu-${group.type}`} className="text-lg font-bold">
                        {SEARCH_TYPES[group.type].label} <span className="font-normal text-ink-muted">({group.total})</span>
                      </h3>
                      <p className="text-sm text-ink-muted">{TYPE_DESCRIPTIONS[group.type]}</p>
                    </div>
                    <Link
                      href={searchHref(SEARCH, forType(params, group.type))}
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Voir {group.total > 1 ? `les ${group.total}` : "le résultat"}
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </div>
                  <ResultGrid items={group.items} now={search.now} label={SEARCH_TYPES[group.type].label} />
                </section>
              ))}
              {SEARCH_TYPE_KEYS.some((type) => counts[type] === 0) && (
                <p className="text-sm text-ink-muted">
                  Aucun résultat dans :{" "}
                  {SEARCH_TYPE_KEYS.filter((type) => counts[type] === 0)
                    .map((type) => SEARCH_TYPES[type].label)
                    .join(", ")}
                  .
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
