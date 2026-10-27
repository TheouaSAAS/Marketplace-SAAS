import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { NetworkToggle, OfferForm, OfferToggle, ProviderForm, ReconcileForm, RouteForm, ServiceForm } from "@/modules/cabin/components/admin-forms";
import { feeRateLabel, formatXof, STATUS_META } from "@/modules/cabin/domain/cabin";
import { listCabinOperations, loadCabinAdminConfig, OPERATION_FILTERS, type OperationFilter } from "@/modules/cabin/server/admin";
import { registeredAdapterCodes } from "@/modules/cabin/server/providers";
import { loadCabinCatalog } from "@/modules/cabin/server/queries";

export const metadata: Metadata = {
  title: "Cabine en ligne — administration",
  robots: { index: false, follow: false },
};

const SECTION = "flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-6";

async function CabinAdmin({ searchParams }: { searchParams: PageProps<"/admin/cabine">["searchParams"] }) {
  // Administrateurs seulement (avec second facteur) : données financières et personnelles masquées.
  const account = await teamAccount("adminCabin", "admin");
  if (!account) return <AccessDenied audience="admin" />;
  const params = await searchParams;
  const filter: OperationFilter = typeof params.etat === "string" && params.etat in OPERATION_FILTERS ? (params.etat as OperationFilter) : "a_examiner";

  let catalog, config, operations;
  try {
    [catalog, config, operations] = await Promise.all([loadCabinCatalog(), loadCabinAdminConfig(), listCabinOperations(filter)]);
  } catch (error) {
    logger.error("Administration de la cabine indisponible", { module: "cabine", error });
    return <ErrorState title="Administration de la cabine indisponible" description="Réessayez dans quelques instants." />;
  }
  if (!catalog) return <Alert tone="warning">Base de données non configurée.</Alert>;
  const providerOptions = config.providers.map(({ code, name }) => ({ code, name }));
  const adapters = registeredAdapterCodes();
  const name = (code: string | null) => catalog.networks.find((item) => item.code === code)?.name ?? code ?? "";

  return (
    <div className="flex flex-col gap-8">
      <Alert tone={adapters.length ? "info" : "warning"} title={adapters.length ? "Intégrations installées" : "Aucune intégration de prestataire installée"}>
        {adapters.length
          ? `Intégrations présentes dans le code : ${adapters.join(", ")}. Le mode réel exige aussi leurs clés sur le serveur.`
          : "Toutes les opérations restent en démonstration : rien n’est payé, rechargé ni transféré. Le mode réel exige un prestataire agréé sous contrat, son intégration dans le code et ses clés sur le serveur (voir docs/cabine.md)."}
      </Alert>

      <section aria-labelledby="operations" className={SECTION}>
        <h2 id="operations" className="text-xl font-bold">
          Opérations
        </h2>
        <nav aria-label="Filtrer les opérations" className="flex flex-wrap gap-2">
          {(Object.keys(OPERATION_FILTERS) as OperationFilter[]).map((key) => (
            <Link
              key={key}
              href={href("adminCabin", { query: { etat: key } })}
              aria-current={key === filter ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-semibold",
                key === filter ? "bg-brand-600 text-white" : "border border-border bg-surface hover:bg-sand-100",
              )}
            >
              {OPERATION_FILTERS[key].label}
            </Link>
          ))}
        </nav>
        {operations.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucune opération dans cette vue.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {operations.map((operation) => (
              <li key={operation.id} className="flex flex-col gap-2 rounded-control border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{operation.reference}</span>
                  <Badge tone={STATUS_META[operation.status].tone}>{STATUS_META[operation.status].label}</Badge>
                  <Badge tone={operation.mode === "live" ? "brand" : "warning"}>{operation.mode === "live" ? "Réel" : "Démonstration"}</Badge>
                  <span className="text-sm text-ink-muted">{formatDateTime(operation.created_at)}</span>
                </div>
                <p className="text-sm">
                  {catalog.services.find((item) => item.service === operation.service)?.label} · {name(operation.network_code)}
                  {operation.target_network_code ? ` → ${name(operation.target_network_code)}` : ""} · {operation.recipient_masked}
                </p>
                <p className="text-sm">
                  {formatXof(operation.amount_xof)} + frais {formatXof(operation.service_fee_xof)} ({feeRateLabel(operation.fee_bps)})
                  {operation.provider_fee_xof ? ` + fournisseur ${formatXof(operation.provider_fee_xof)}` : ""} = <strong>{formatXof(operation.total_xof)}</strong>
                  {operation.provider_reference ? ` · réf. prestataire ${operation.provider_reference}` : ""}
                </p>
                {operation.status_reason && <p className="text-sm text-ink-muted">{operation.status_reason}</p>}
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold">Historique et rapprochement</summary>
                  <ol className="my-2 flex flex-col gap-1 text-sm">
                    {operation.events.map((event) => (
                      <li key={`${event.created_at}-${event.to_status}`}>
                        {formatDateTime(event.created_at)} — {event.from_status ? `${STATUS_META[event.from_status].label} → ` : ""}
                        {STATUS_META[event.to_status].label} ({event.source}){event.detail ? ` : ${event.detail}` : ""}
                      </li>
                    ))}
                  </ol>
                  <ReconcileForm operationId={operation.id} status={operation.status} live={operation.mode === "live"} />
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="services" className={SECTION}>
        <h2 id="services" className="text-xl font-bold">
          Services et frais
        </h2>
        <p className="text-sm text-ink-muted">
          Frais de service appliqués par la base, arrondis au franc CFA le plus proche ; tout changement impose une nouvelle confirmation au visiteur.
        </p>
        {catalog.services.map((service) => (
          <div key={service.service} className="flex flex-col gap-2 border-t border-border pt-3">
            <h3 className="flex flex-wrap items-center gap-2 font-bold">
              {service.label}
              <Badge tone={!service.is_enabled ? "neutral" : service.mode === "live" ? "success" : "warning"}>
                {!service.is_enabled ? "Suspendu" : service.mode === "live" ? "Réel" : "Démonstration"}
              </Badge>
            </h3>
            <p className="text-sm text-ink-muted">{service.modeReason}</p>
            <ServiceForm
              service={service.service}
              label={service.label}
              enabled={service.is_enabled}
              feeBps={service.fee_bps}
              min={service.min_amount_xof}
              max={service.max_amount_xof}
              provider={service.provider_code}
              providers={providerOptions}
            />
          </div>
        ))}
      </section>

      <section aria-labelledby="prestataires" className={SECTION}>
        <h2 id="prestataires" className="text-xl font-bold">
          Prestataires
        </h2>
        {config.providers.length === 0 && <p className="text-sm text-ink-muted">Aucun prestataire enregistré.</p>}
        {config.providers.map((provider) => (
          <details key={provider.code} className="border-t border-border pt-3">
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 font-semibold">
              {provider.name}
              <Badge tone={provider.is_active ? "success" : "neutral"}>{provider.is_active ? "Actif" : "Suspendu"}</Badge>
              <Badge tone={provider.mode === "live" ? "brand" : "warning"}>{provider.mode === "live" ? "Réel" : "Démonstration"}</Badge>
            </summary>
            <div className="mt-3">
              <ProviderForm provider={provider} />
            </div>
          </details>
        ))}
        <details className="border-t border-border pt-3">
          <summary className="min-h-11 cursor-pointer font-semibold">Ajouter un prestataire</summary>
          <div className="mt-3">
            <ProviderForm />
          </div>
        </details>
      </section>

      <section aria-labelledby="reseaux" className={SECTION}>
        <h2 id="reseaux" className="text-xl font-bold">
          Réseaux
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {catalog.networks.map((network) => (
            <li key={network.code} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border p-3">
              <span className="flex items-center gap-2 font-semibold">
                {network.name}
                <Badge tone={network.is_active ? "success" : "neutral"}>{network.is_active ? "Actif" : "Suspendu"}</Badge>
              </span>
              <NetworkToggle code={network.code} name={network.name} active={network.is_active} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="transferts" className={SECTION}>
        <h2 id="transferts" className="text-xl font-bold">
          Transferts entre réseaux
        </h2>
        <p className="text-sm text-ink-muted">Activez une combinaison seulement si le prestataire choisi la prend en charge contractuellement.</p>
        <ul className="flex flex-col gap-3">
          {catalog.routes.map((route) => (
            <li key={`${route.source_code}-${route.target_code}`} className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {name(route.source_code)} → {name(route.target_code)}
                <Badge tone={route.live ? "success" : route.is_enabled ? "warning" : "neutral"}>
                  {route.live ? "Réelle" : route.is_enabled ? "Activée (démonstration)" : "Désactivée"}
                </Badge>
              </p>
              <RouteForm source={route.source_code} target={route.target_code} provider={route.provider_code} enabled={route.is_enabled} providers={providerOptions} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="offres" className={SECTION}>
        <h2 id="offres" className="text-xl font-bold">
          Catalogue des offres Internet
        </h2>
        <p className="text-sm text-ink-muted">Uniquement des offres réelles, avec leur origine : aucune offre n’est proposée tant que le catalogue est vide.</p>
        {config.offers.length > 0 && (
          <ul className="flex flex-col gap-2">
            {config.offers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border p-3 text-sm">
                <span>
                  <strong>{name(offer.network_code)}</strong> · {offer.name} · {formatXof(offer.price_xof)}
                  {offer.data_volume ? ` · ${offer.data_volume}` : ""}
                  {offer.validity ? ` · ${offer.validity}` : ""} — source : {offer.source}, relevé le {new Date(offer.checked_on).toLocaleDateString("fr-FR")}
                  {!offer.is_active && " (retirée)"}
                </span>
                <OfferToggle id={offer.id} active={offer.is_active} />
              </li>
            ))}
          </ul>
        )}
        <OfferForm networks={catalog.networks.filter((item) => item.kind === "telecom").map(({ code, name: label }) => ({ code, name: label }))} />
      </section>
    </div>
  );
}

export default function AdminCabinPage({ searchParams }: PageProps<"/admin/cabine">) {
  return (
    <AdminFrame
      title="Cabine en ligne"
      intro="Services, frais, prestataires, réseaux, offres et opérations. Réservé aux administrateurs : chaque rapprochement exige une raison et figure au journal."
    >
      <CabinAdmin searchParams={searchParams} />
    </AdminFrame>
  );
}
