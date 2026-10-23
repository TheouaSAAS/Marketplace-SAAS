import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { href } from "@/config/routes";
import { formatPrice, type PriceUnit } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { displayAttributes } from "@/modules/listings/domain/attributes";
import { LOCATION_DISPLAY } from "@/modules/listings/domain/presentation";
import { fieldLabel } from "@/modules/publishing/domain/draft-fields";
import { submissionProblems } from "@/modules/publishing/domain/fields";
import { checkListing } from "@/modules/publishing/domain/rules";
import { SubmitListingForm } from "@/modules/publishing/components/publish-forms";
import { getEditableListing, listListingPhotos, listSuggestions, publishableCategories } from "@/modules/publishing/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Aperçu de l’annonce",
  robots: { index: false, follow: false },
};

async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await requireAccount(href("publishPreview", { params: { id } }));
  let data;
  try {
    const listing = await getEditableListing(id);
    if (listing && listing.row.owner_id === account.id) {
      const [photos, suggestions, { flat }] = await Promise.all([listListingPhotos(id), listSuggestions(id), publishableCategories()]);
      data = { listing, photos, suggestions, category: flat.find((item) => item.id === listing.row.category_id) };
    }
  } catch (error) {
    logger.error("Aperçu d’annonce indisponible", { module: "publication", error });
    return <ErrorState title="Aperçu momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  if (!data) notFound();
  const { listing, photos, suggestions, category } = data;
  const { draft, row } = listing;
  const schema = category?.schema ?? null;
  const attributes = displayAttributes(schema, draft.attributes);
  const location = LOCATION_DISPLAY[draft.publicPrecision];
  const problems = submissionProblems(draft, schema);
  const hits = checkListing(`${draft.title}\n${draft.description}\n${JSON.stringify(draft.attributes)}`);
  const accepted = suggestions.filter((item) => item.status === "acceptee");
  const contacts = [
    draft.showPhone && draft.contactPhone && `Téléphone : ${draft.contactPhone}`,
    draft.showWhatsapp && draft.contactWhatsapp && `WhatsApp : ${draft.contactWhatsapp}`,
    draft.showEmail && draft.contactEmail && `E-mail : ${draft.contactEmail}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info" title="Aperçu — non publié">
        Voici ce que verront les visiteurs après validation par l’équipe. Rien n’est visible publiquement pour l’instant.
      </Alert>

      <article className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && <Badge tone="brand">{category.parentName ? `${category.parentName} › ${category.name}` : category.name}</Badge>}
          <Badge tone="neutral">{row.status === "draft" ? "Brouillon" : row.status === "pending" ? "En attente" : row.status}</Badge>
        </div>
        <h2 className="text-2xl font-extrabold">{draft.title || "(titre manquant)"}</h2>
        <p className="text-xl font-bold text-brand-700">
          {formatPrice(draft.price, (draft.priceUnit ?? "total") as PriceUnit)}
          {draft.negotiable && draft.price !== null && <span className="ml-2 text-sm font-normal text-ink-muted">à débattre</span>}
        </p>
        {photos.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-3" aria-label="Photos">
            {photos.map((photo, index) => (
              <li key={photo.id}>
                {photo.url && (
                  // Adresse signée du stockage privé : pas d'optimisation d'image côté serveur.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.alt || `Photo ${index + 1}`} className="aspect-[4/3] w-full rounded-control object-cover" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">Aucune photo.</p>
        )}
        {attributes.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
            {attributes.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-ink-muted">{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="whitespace-pre-line">{draft.description || "(description manquante)"}</p>
        <p className="text-sm">
          <span className="font-semibold">Emplacement affiché : </span>
          {draft.lat === null ? "aucun" : `${location.label}. ${location.description}`}
        </p>
        <p className="text-sm">
          <span className="font-semibold">Contact : </span>
          {contacts.length ? contacts.join(" · ") : "messagerie de la plateforme uniquement"}
        </p>
      </article>

      {accepted.length > 0 && (
        <section aria-labelledby="trace" className="rounded-card border border-border p-4 text-sm">
          <h2 id="trace" className="font-bold">
            Champs issus de l’assistant ({accepted.length})
          </h2>
          <p className="text-ink-muted">Vous les avez validés un par un ; l’équipe de modération voit cette trace.</p>
          <ul className="mt-2 list-disc pl-5">
            {accepted.map((item) => (
              <li key={item.id}>
                {fieldLabel(item.field, schema)} — {item.origin === "ia" ? "IA" : "règles"}, {item.input_kind}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hits.length > 0 && (
        <Alert tone="danger" title="Contenu à retirer avant soumission">
          <ul className="list-disc pl-4">
            {hits.map((hit) => (
              <li key={hit.rule}>
                {hit.rule} (« {hit.excerpt} ») : {hit.advice}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert tone="warning" title="À compléter">
          <ul className="list-disc pl-4">
            {problems.map((problem) => (
              <li key={problem.field}>{problem.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Link href={href("publishEditor", { params: { id } })} className="inline-flex items-center gap-1.5 font-semibold underline">
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Revenir à la rédaction
        </Link>
        {row.status === "draft" && problems.length === 0 && hits.length === 0 && <SubmitListingForm listingId={id} />}
      </div>
    </div>
  );
}

export default function PublishPreviewPage({ params }: PageProps<"/publier/[id]/apercu">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Publier une annonce", href: href("publish") }, { label: "Aperçu" }]} />
      <h1 className="text-3xl font-extrabold">Aperçu de mon annonce</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Preview params={params} />
      </Suspense>
    </Container>
  );
}
