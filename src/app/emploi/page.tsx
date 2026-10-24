import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus, SlidersHorizontal, UserRound } from "lucide-react";
import { href, ROUTES } from "@/config/routes";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form-controls";
import { PageNav } from "@/components/ui/page-nav";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CONTRACTS, DOMAINS, EXPERIENCE, JOB_TYPES, ORGANIZATIONS, REMOTE } from "@/modules/jobs/domain/attributes";
import { jobQuery, SINCE, type JobFilters } from "@/modules/jobs/domain/params";
import { JobCard } from "@/modules/jobs/components/job-card";
import { loadJobsPage } from "@/modules/jobs/server/page-data";

/** Variantes filtrées ou triées : canonique vers la rubrique, non indexées. */
export async function generateMetadata({ searchParams }: PageProps<"/emploi">): Promise<Metadata> {
  return listMetadata({
    title: "Emploi et opportunités à San Pedro",
    description: "Offres d’emploi, stages, missions, formations, appels à prestataires : offres modérées, candidatures privées, dates limites respectées.",
    path: "/emploi",
    searchParams: await searchParams,
    keep: ["type"],
  });
}

type Raw = Record<string, string | string[] | undefined>;

const link = (filters: JobFilters, change: Partial<JobFilters>) => {
  const query = jobQuery({ ...filters, page: 1, ...change });
  return query ? `${href("jobs")}?${query}` : href("jobs");
};

function Choice({ label, name, table, value }: { label: string; name: string; table: Record<string, string>; value: string | null }) {
  return (
    <Field label={label}>
      {(props) => (
        <Select {...props} name={name} defaultValue={value ?? ""}>
          <option value="">Tous</option>
          {Object.entries(table).map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function Filters({ filters, neighborhoods }: { filters: JobFilters; neighborhoods: { slug: string; name: string }[] }) {
  return (
    <details className="rounded-card border border-border bg-surface lg:border-0 lg:bg-transparent lg:[&::details-content]:[content-visibility:visible] lg:[&::details-content]:block">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold lg:hidden [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal aria-hidden className="h-4 w-4" />
        Filtres
      </summary>
      <Form action={href("jobs")} className="flex flex-col gap-3 border-t border-border p-4 lg:border-0 lg:p-0" aria-label="Filtres des offres">
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        <Choice label="Contrat" name="contrat" table={CONTRACTS} value={filters.contrat} />
        <Choice label="Domaine" name="domaine" table={DOMAINS} value={filters.domaine} />
        <Choice label="Expérience" name="experience" table={EXPERIENCE} value={filters.experience} />
        <Choice label="Lieu de travail" name="teletravail" table={REMOTE} value={filters.teletravail} />
        <Choice label="Type d’organisation" name="organisation" table={ORGANIZATIONS} value={filters.organisation} />
        <Choice label="Date de publication" name="depuis" table={SINCE} value={filters.depuis ? String(filters.depuis) : null} />
        {neighborhoods.length > 0 && (
          <Field label="Quartier">
            {(props) => (
              <Select {...props} name="quartier" defaultValue={filters.quartier ?? ""}>
                <option value="">Toute la ville</option>
                {neighborhoods.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Appliquer
        </button>
      </Form>
    </details>
  );
}

async function Jobs({ searchParams }: { searchParams: Promise<Raw> }) {
  const data = await loadJobsPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("jobs")}?${data.query}` : href("jobs"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Espace emploi indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="L’espace emploi est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  const { filters } = data;
  return (
    <div className="flex flex-col gap-5">
      <Form action={href("jobs")} role="search" className="flex w-full max-w-3xl gap-2">
        {filters.type && <input type="hidden" name="type" value={filters.type} />}
        <label htmlFor="emploi-q" className="sr-only">
          Rechercher une offre
        </label>
        <input
          id="emploi-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={120}
          placeholder="Ex. comptable, chauffeur, stage informatique"
          className="h-12 flex-1 rounded-pill border border-border-strong bg-surface px-4 text-base placeholder:text-ink-subtle focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
        <button type="submit" className="inline-flex h-12 shrink-0 items-center rounded-pill bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          Rechercher
        </button>
      </Form>
      <nav aria-label="Types d’annonces">
        <ul className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {[{ slug: null, name: "Tout" }, ...data.types.map((type) => ({ slug: type.slug, name: JOB_TYPES[type.slug as keyof typeof JOB_TYPES] }))].map((item) => (
            <li key={item.slug ?? "tout"} className="shrink-0">
              <Link
                href={link(filters, { type: item.slug as JobFilters["type"] })}
                aria-current={item.slug === filters.type ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold",
                  item.slug === filters.type ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface hover:border-brand-300",
                )}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Affiner">
          <Filters key={jobQuery(filters)} filters={filters} neighborhoods={data.neighborhoods} />
        </aside>
        <section aria-labelledby="offres" className="flex min-w-0 flex-col gap-4">
          <h2 id="offres" className="text-xl font-bold">
            {data.total} annonce{data.total > 1 ? "s" : ""} ouverte{data.total > 1 ? "s" : ""}
          </h2>
          <p className="text-sm text-ink-muted">Les plus récentes d’abord. Les offres expirées ou clôturées n’apparaissent plus.</p>
          {data.total === 0 ? (
            <EmptyState title="Aucune annonce ne correspond" description="Retirez un filtre, ou publiez une offre : elle sera relue par l’équipe avant publication." />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.jobs.map((job) => (
                <li key={job.id}>
                  <JobCard job={job} now={now} href={href("listingDetail", { params: { slug: job.slug } })} />
                </li>
              ))}
            </ul>
          )}
          <PageNav page={filters.page} total={data.total} pageSize={data.pageSize} hrefFor={(page) => link(filters, { page })} />
        </section>
      </div>
    </div>
  );
}

export default function JobsPage({ searchParams }: PageProps<"/emploi">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Emploi et opportunités" }]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Emploi et opportunités</h1>
          <p className="max-w-2xl text-ink-muted">
            Offres relues par l’équipe avant publication. Votre candidature n’est visible que de l’employeur ; aucun frais ne doit jamais vous être demandé.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={href("publishJob")} icon={<Plus aria-hidden className="h-4 w-4" />}>
            Publier une offre
          </ButtonLink>
          <ButtonLink href={href("candidateProfile")} variant="secondary" icon={<UserRound aria-hidden className="h-4 w-4" />}>
            Mon profil candidat
          </ButtonLink>
        </div>
      </div>
      <nav aria-label="Mon espace emploi" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {(["myApplications", "receivedApplications", "candidates"] as const).map((key) => (
          <Link key={key} href={href(key)} className="font-semibold text-brand underline">
            {ROUTES[key].label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Jobs searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
