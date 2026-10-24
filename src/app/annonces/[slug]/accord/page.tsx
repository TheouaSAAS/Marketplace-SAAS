import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { formatPrice, type PriceUnit } from "@/lib/format";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { getPublicListing } from "@/modules/listings/server/detail";
import { PrintButton } from "@/modules/trust/components/print-button";
import { AGREEMENT_CHECKS, AGREEMENT_DISCLAIMER, BUYER_COMMITMENTS, CHARTER_VERSION, SELLER_COMMITMENTS } from "@/modules/trust/domain/charter";

export const metadata: Metadata = {
  title: "Accord de transaction",
  robots: { index: false, follow: false },
};

type Props = PageProps<"/annonces/[slug]/accord">;

const blank = "………………………………………………";

function Party({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-card border border-border p-3 text-sm print:border-black">
      <h3 className="font-bold">{title}</h3>
      <p>Nom et prénoms : {blank}</p>
      <p>Pièce d’identité (type et numéro) : {blank}</p>
      <p>Téléphone : {blank}</p>
    </section>
  );
}

async function Agreement({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const listing = await getPublicListing(slug);
  if (!listing) notFound();
  const listingPath = href("listingDetail", { params: { slug } });
  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={listingPath} className="text-sm underline">
          Revenir à l’annonce
        </Link>
        <PrintButton />
      </div>
      <header className="flex flex-col gap-1">
        <p className="text-sm text-ink-muted">
          {SITE.name} · accord établi d’après la charte de confiance (version {CHARTER_VERSION})
        </p>
        <h1 className="text-3xl font-extrabold">Accord de transaction</h1>
      </header>
      <Alert tone="warning" title="Modèle indicatif" className="print:border print:border-black">
        {AGREEMENT_DISCLAIMER}
      </Alert>

      <section className="flex flex-col gap-1 text-sm">
        <h2 className="text-lg font-bold">Objet</h2>
        <p>
          Annonce « <strong>{listing.title}</strong> » ({listing.category?.name ?? "annonce"}), publiée sur {SITE.url.replace(/^https?:\/\//, "")}
          {listingPath}.
        </p>
        <p>Prix affiché dans l’annonce : {formatPrice(listing.price, (listing.price_unit ?? "total") as PriceUnit)}.</p>
        <p>Prix convenu entre les parties : {blank} FCFA.</p>
        <p>Date et lieu de remise ou d’entrée dans les lieux : {blank}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        <Party title="L’annonceur (vendeur, bailleur ou prestataire)" />
        <Party title="Le visiteur (acheteur, locataire ou client)" />
      </div>

      <section className="flex flex-col gap-1 text-sm">
        <h2 className="text-lg font-bold">Vérifications faites ensemble</h2>
        <ul className="flex flex-col gap-1">
          {AGREEMENT_CHECKS.map((check) => (
            <li key={check}>☐ {check}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 text-sm sm:grid-cols-2 print:grid-cols-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">L’annonceur s’engage à</h2>
          <ul className="list-disc pl-5">
            {SELLER_COMMITMENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">Le visiteur s’engage à</h2>
          <ul className="list-disc pl-5">
            {BUYER_COMMITMENTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-2 text-sm">
        <h2 className="text-lg font-bold">Signatures</h2>
        <p>Fait à {blank}, le {blank}, en deux exemplaires.</p>
        <div className="grid grid-cols-2 gap-6 pt-2">
          <p className="border-t border-border pt-2 print:border-black">L’annonceur (« lu et approuvé »)</p>
          <p className="border-t border-border pt-2 print:border-black">Le visiteur (« lu et approuvé »)</p>
        </div>
      </section>
    </article>
  );
}

export default function AgreementPage({ params }: Props) {
  return (
    <Container className="flex max-w-3xl flex-col py-8 sm:py-12 print:py-0">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Agreement params={params} />
      </Suspense>
    </Container>
  );
}
