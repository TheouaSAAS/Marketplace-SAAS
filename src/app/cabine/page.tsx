import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { CabinWizard } from "@/modules/cabin/components/cabin-wizard";
import { feeRateLabel, formatXof, serviceFee, STATUS_META, totals } from "@/modules/cabin/domain/cabin";
import { listMyCabinOperations, loadCabinCatalog, type CabinHistoryItem } from "@/modules/cabin/server/queries";
import { getSessionUser } from "@/server/auth";
import { isFeatureClosed } from "@/server/features";

export const metadata: Metadata = {
  title: "Cabine en ligne",
  description: `Crédit téléphonique, offres Internet, recharge de compteur CIE et transferts entre réseaux, sur un seul écran — ${SITE.name}.`,
  alternates: { canonical: `${SITE.url}${href("cabin")}` },
};

async function History() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <p className="text-sm text-ink-muted">
        Sans compte, chaque opération se suit sur cet appareil.{" "}
        <Link href={href("login", { query: { suivant: href("cabin") } })} className="font-semibold text-brand-700 underline">
          Connectez-vous
        </Link>{" "}
        pour retrouver votre historique (facultatif).
      </p>
    );
  }
  let items: CabinHistoryItem[] = [];
  try {
    items = await listMyCabinOperations();
  } catch (error) {
    logger.warn("Historique de la cabine indisponible", { module: "cabine", error });
  }
  if (items.length === 0) return <p className="text-sm text-ink-muted">Aucune opération enregistrée avec votre compte.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
      {items.map((item) => (
        <li key={item.reference} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
          <span className="font-semibold">{item.reference}</span>
          <Badge tone={STATUS_META[item.status].tone}>{STATUS_META[item.status].label}</Badge>
          {item.mode === "demo" && <Badge tone="warning">Démonstration</Badge>}
          <span>{item.recipient_masked}</span>
          <span className="font-semibold">{formatXof(item.total_xof)}</span>
          <span className="text-ink-muted">{formatDateTime(item.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

async function Cabin() {
  // Configuration lue en direct (services suspendus aussitôt) : rendu à chaque requête, jamais figé au pré-rendu.
  await connection();
  // Coupée par l'équipe (drapeau) ≠ indisponible (base injoignable) : chaque cas a son message.
  if (isFeatureClosed("cabin")) {
    return <Alert tone="warning" title="Cabine suspendue">La cabine est momentanément suspendue par l’équipe. Les autres rubriques restent accessibles.</Alert>;
  }
  let catalog;
  try {
    catalog = await loadCabinCatalog();
  } catch (error) {
    logger.error("Cabine indisponible", { module: "cabine", error });
    return <ErrorState title="La cabine est momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  if (!catalog) return <Alert tone="warning" title="Cabine indisponible">La base de données n’est pas configurée.</Alert>;
  const live = catalog.services.some((service) => service.is_enabled && service.mode === "live");
  // Taux configuré par l'administration (identique pour tous les services, sinon affiché service par service au récapitulatif).
  const rates = [...new Set(catalog.services.filter((service) => service.is_enabled).map((service) => service.fee_bps))];
  return (
    <div className="flex flex-col gap-6">
      {rates.length === 1 && (
        <p className="text-sm">
          Frais de service : <strong>{feeRateLabel(rates[0]!)}</strong> du montant, arrondis au franc CFA le plus proche (exemple : 10 000 F CFA →{" "}
          {formatXof(serviceFee(10_000, rates[0]!))} de frais, soit {formatXof(totals(10_000, rates[0]!).total)} à payer).
        </p>
      )}
      {!live && (
        <Alert tone="warning" title="Mode démonstration : aucune opération réelle">
          Aucun prestataire de paiement agréé n’est encore connecté. Vous pouvez parcourir chaque service et voir les frais exacts, mais rien n’est
          payé, rechargé ni transféré, et aucune opération n’est présentée comme réussie.
        </Alert>
      )}
      <CabinWizard catalog={catalog} />
      <section aria-labelledby="historique" className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 id="historique" className="text-lg font-bold">
          Mes opérations
        </h2>
        <Suspense fallback={<Skeleton className="h-16 w-full" />}>
          <History />
        </Suspense>
      </section>
    </div>
  );
}

export default function CabinPage() {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Services de proximité", href: href("services") }, { label: "Cabine en ligne" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Cabine en ligne</h1>
        <p className="max-w-2xl text-ink-muted">
          Crédit et unités, offres Internet, recharge de compteur CIE et transferts entre Wave, Orange Money, Moov Money et MTN MoMo, sur un seul écran
          et sans créer de compte. Les frais de service sont toujours affichés avant confirmation.
        </p>
        <p className="flex items-center gap-1.5 text-sm text-ink-muted">
          <ShieldCheck aria-hidden className="h-4 w-4 text-success" />
          Nous ne demandons jamais votre code secret Mobile Money ou bancaire.
        </p>
      </div>
      {/* Au moins un écran : le pied de page ne saute pas à l'arrivée du contenu. */}
      <Suspense fallback={<Skeleton className="min-h-svh w-full rounded-card" />}>
        <Cabin />
      </Suspense>
    </Container>
  );
}
