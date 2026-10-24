import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Info, Plus, Search } from "lucide-react";
import { href } from "@/config/routes";
import { BusinessCard } from "@/components/content/content-cards";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice-controls";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form-controls";
import { PageNav } from "@/components/ui/page-nav";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SERVICES_RANKING_RULE, serviceQuery } from "@/modules/services/domain/params";
import { proContext } from "@/modules/services/domain/present";
import { PRO_BADGES } from "@/modules/businesses/domain/pro";
import { loadDirectoryPage } from "@/modules/businesses/server/directory";

/** Variantes filtrées ou triées : canonique vers la rubrique, non indexées. */
export async function generateMetadata({ searchParams }: PageProps<"/professionnels">): Promise<Metadata> {
  return listMetadata({
    title: "Professionnels et entreprises",
    description: "Annuaire des professionnels de San Pedro : artisans, commerces, agences, opérateurs. Badges expliqués, avis modérés.",
    path: "/professionnels",
    searchParams: await searchParams,
    keep: ["categorie"],
  });
}

type Raw = Record<string, string | string[] | undefined>;

async function Directory({ searchParams }: { searchParams: Promise<Raw> }) {
  const data = await loadDirectoryPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("directory")}?${data.query}` : href("directory"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Annuaire indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="L’annuaire est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  const { filters } = data;
  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <aside aria-label="Affiner">
        <Form action={href("directory")} aria-label="Filtres de l’annuaire" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Field label="Nom, prestation, mot-clé">
            {(props) => <input {...props} name="q" defaultValue={filters.q} maxLength={120} className="min-h-11 rounded-control border border-border-strong bg-surface px-3" />}
          </Field>
          <Field label="Activité">
            {(props) => (
              <Select {...props} name="metier" defaultValue={filters.metier ?? ""}>
                <option value="">Toutes les activités</option>
                {data.groups.map((group) =>
                  group.children.length ? (
                    <optgroup key={group.slug} label={group.name}>
                      <option value={group.slug}>Tout : {group.name}</option>
                      {group.children.map((child) => (
                        <option key={child.slug} value={child.slug}>
                          {child.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={group.slug} value={group.slug}>
                      {group.name}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
          {data.neighborhoods.length > 0 && (
            <Field label="Quartier">
              {(props) => (
                <Select {...props} name="quartier" defaultValue={filters.quartier ?? ""}>
                  <option value="">Toute la ville</option>
                  {data.neighborhoods.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Checkbox name="verifie" value="1" label="Vérifiés par l’équipe locale seulement" defaultChecked={filters.verifie} />
          <Button type="submit" icon={<Search aria-hidden className="h-4 w-4" />}>
            Rechercher
          </Button>
        </Form>
      </aside>
      <section aria-labelledby="resultats" className="flex min-w-0 flex-col gap-4">
        <h2 id="resultats" className="text-xl font-bold">
          {data.total} professionnel{data.total > 1 ? "s" : ""}
          {data.category ? ` · ${data.category.name}` : ""}
        </h2>
        <details className="text-sm text-ink-muted">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
            <Info aria-hidden className="h-4 w-4" />
            Pourquoi cet ordre ? Que signifient les badges ?
          </summary>
          <p className="mt-1 max-w-2xl">{SERVICES_RANKING_RULE} La mise en avant sponsorisée ne change pas cet ordre.</p>
          <dl className="mt-2 grid max-w-2xl gap-1 sm:grid-cols-[11rem_minmax(0,1fr)]">
            {Object.values(PRO_BADGES).map((badge) => (
              <div key={badge.label} className="contents">
                <dt className="font-semibold">{badge.label}</dt>
                <dd>{badge.definition}</dd>
              </div>
            ))}
          </dl>
        </details>
        {data.total === 0 ? (
          <EmptyState title="Aucun professionnel ne correspond" description="L’annuaire démarre : retirez un filtre ou choisissez une activité voisine." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((pro, index) => (
              <li key={pro.id} className="flex [&>article]:flex-1">
                <BusinessCard business={pro} now={now} index={index} context={proContext(pro)} href={href("professionalDetail", { params: { slug: pro.slug } })} />
              </li>
            ))}
          </ul>
        )}
        <PageNav page={filters.page} total={data.total} pageSize={data.pageSize} hrefFor={(page) => `${href("directory")}?${serviceQuery({ ...filters, page })}`} />
      </section>
    </div>
  );
}

export default function DirectoryPage({ searchParams }: PageProps<"/professionnels">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Professionnels et entreprises" }]} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Professionnels et entreprises</h1>
          <p className="max-w-2xl text-ink-muted">
            Artisans, commerces, agences et opérateurs de San Pedro. « Vérifié » signifie contrôlé par l’équipe locale ; un profil complété ou sponsorisé
            ne l’est pas pour autant.
          </p>
        </div>
        <ButtonLink href={href("proPages")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Créer ma page professionnelle
        </ButtonLink>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Directory searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-ink-muted">
        Vous cherchez un artisan pour un besoin précis ?{" "}
        <Link href={href("services")} className="font-semibold underline">
          Décrivez-le dans les services de proximité
        </Link>
        .
      </p>
    </Container>
  );
}
