import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { href } from "@/config/routes";
import { LAUNCH_CITY } from "@/domain/city";
import { publicEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { ListingEditor } from "@/modules/publishing/components/listing-editor";
import { DeleteDraftForm } from "@/modules/dashboard/components/dashboard-forms";
import { reopenAsDraftAction } from "@/modules/publishing/server/actions";
import { aiAvailability } from "@/modules/publishing/server/ai";
import { getEditableListing, listListingPhotos, listSuggestions, publishableCategories } from "@/modules/publishing/server/queries";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = {
  title: "Rédiger une annonce",
  robots: { index: false, follow: false },
};

function StatusPanel({ status, reason, id, slug }: { status: string; reason: string | null; id: string; slug: string }) {
  if (status === "pending") {
    return (
      <Alert tone="info" title="En attente de modération">
        <p>L’équipe relit votre annonce ; vous serez notifié de sa décision.</p>
        <form action={reopenAsDraftAction} className="mt-2">
          <input type="hidden" name="annonce" value={id} />
          <button type="submit" className="font-semibold underline">
            La retirer de la modération pour la modifier
          </button>
        </form>
      </Alert>
    );
  }
  if (status === "rejected") {
    return (
      <Alert tone="danger" title="Annonce refusée">
        {reason && <p>Motif : {reason}</p>}
        <form action={reopenAsDraftAction} className="mt-2">
          <input type="hidden" name="annonce" value={id} />
          <button type="submit" className="font-semibold underline">
            Corriger l’annonce
          </button>
        </form>
      </Alert>
    );
  }
  return (
    <Alert tone={status === "published" ? "success" : "info"} title={status === "published" ? "Annonce publiée" : "Annonce non modifiable"}>
      {status === "published" && (
        <Link href={href("listingDetail", { params: { slug } })} className="font-semibold underline">
          Voir l’annonce
        </Link>
      )}
      <p className="mt-1">La modification d’une annonce déjà publiée arrivera avec le tableau de bord ; en attendant, contactez l’équipe si elle doit changer.</p>
    </Alert>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await requireAccount(href("publishEditor", { params: { id } }));
  let data;
  try {
    const listing = await getEditableListing(id);
    if (!listing || listing.row.owner_id !== account.id) {
      data = null;
    } else if (listing.row.status !== "draft") {
      data = { listing, editor: null };
    } else {
      const { current } = await getCityContext();
      const [photos, suggestions, { flat }, neighborhoods, ai] = await Promise.all([
        listListingPhotos(id),
        listSuggestions(id),
        publishableCategories(),
        current.id ? listNeighborhoods(current.id) : Promise.resolve([]),
        aiAvailability(),
      ]);
      data = { listing, editor: { photos, suggestions, categories: flat, neighborhoods, ai } };
    }
  } catch (error) {
    logger.error("Éditeur d’annonce indisponible", { module: "publication", error });
    return <ErrorState title="Annonce momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  if (!data) notFound();
  const { listing, editor } = data;
  if (!editor) return <StatusPanel status={listing.row.status} reason={listing.row.rejection_reason} id={id} slug={listing.row.slug} />;
  if (!editor.categories.some((category) => category.id === listing.row.category_id)) {
    return <Alert tone="warning">Cette catégorie n’est plus ouverte à la publication : contactez l’équipe.</Alert>;
  }
  return (
    <div className="flex flex-col gap-6">
      <ListingEditor
        listingId={id}
        userId={account.id}
        initialCategoryId={listing.row.category_id}
        initialDraft={listing.draft}
        categories={editor.categories.map((category) => ({
          id: category.id,
          name: category.parentName ? `${category.parentName} › ${category.name}` : category.name,
          schema: category.schema,
        }))}
        neighborhoods={editor.neighborhoods.map(({ id: neighborhoodId, name }) => ({ id: neighborhoodId, name }))}
        photos={editor.photos}
        initialSuggestions={editor.suggestions}
        ai={editor.ai}
        map={{ enabled: isFeatureEnabled("map"), tileUrl: publicEnv.NEXT_PUBLIC_MAP_TILE_URL, attribution: publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION, center: LAUNCH_CITY.center }}
      />
      <div className="self-start">
        <DeleteDraftForm id={id} />
      </div>
    </div>
  );
}

export default function PublishEditorPage({ params }: PageProps<"/publier/[id]">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Publier une annonce", href: href("publish") }, { label: "Rédaction" }]} />
      <h1 className="text-3xl font-extrabold">Rédiger mon annonce</h1>
      <Suspense fallback={<Skeleton className="h-[40rem] w-full" />}>
        <Editor params={params} />
      </Suspense>
    </Container>
  );
}
