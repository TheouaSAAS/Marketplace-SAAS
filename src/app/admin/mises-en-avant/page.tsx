import type { Metadata } from "next";
import { formatDate, formatPrice } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { CampaignForm } from "@/modules/admin/components/back-office-forms";
import { CAMPAIGN_STATUSES, PLACEMENTS, SUBSCRIPTION_STATUSES } from "@/modules/admin/domain/back-office";
import { listCampaigns, listSubscriptions, type Campaign, type Subscription } from "@/modules/admin/server/back-office";

export const metadata: Metadata = {
  title: "Mises en avant et abonnements — administration",
  robots: { index: false, follow: false },
};

const targetName = (campaign: Campaign) => campaign.listing?.title ?? campaign.place?.name ?? campaign.event?.title ?? campaign.business?.name ?? "Contenu supprimé";

async function Promotions() {
  const account = await teamAccount("adminPromotions", "admin");
  if (!account) return <AccessDenied audience="admin" />;
  let campaigns: Campaign[];
  let subscriptions: Subscription[];
  try {
    [campaigns, subscriptions] = await Promise.all([listCampaigns(), listSubscriptions()]);
  } catch (error) {
    logger.error("Mises en avant indisponibles", { module: "administration", error });
    return <ErrorState title="Mises en avant momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      <Alert tone="info" title="Aucun paiement en ligne">
        Le paiement n’est pas ouvert : une campagne ne peut pas être activée d’ici. L’équipe peut seulement mettre en pause, arrêter ou refuser, avec une raison
        journalisée. Un contenu mis en avant est toujours signalé comme « Sponsorisé ».
      </Alert>
      <section aria-labelledby="campagnes" className="flex flex-col gap-3">
        <h2 id="campagnes" className="text-xl font-bold">
          Campagnes de mise en avant
        </h2>
        {campaigns.length === 0 ? (
          <EmptyState title="Aucune campagne" description="Les campagnes sponsorisées apparaîtront ici." />
        ) : (
          <ul className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold break-words">{targetName(campaign)}</h3>
                  <Badge tone="brand">{PLACEMENTS[campaign.placement]}</Badge>
                  <Badge tone="neutral">{CAMPAIGN_STATUSES[campaign.status]}</Badge>
                </div>
                <p className="text-sm text-ink-muted">
                  Du {formatDate(campaign.starts_at, "short")} au {formatDate(campaign.ends_at, "short")} · budget {formatPrice(campaign.budget_xof)} · {campaign.impressions}{" "}
                  affichage(s), {campaign.clicks} clic(s)
                </p>
                {!["ended", "rejected"].includes(campaign.status) && <CampaignForm campaignId={campaign.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="abonnements" className="flex flex-col gap-3">
        <h2 id="abonnements" className="text-xl font-bold">
          Abonnements
        </h2>
        {subscriptions.length === 0 ? (
          <EmptyState title="Aucun abonnement" description="Les abonnements souscrits apparaîtront ici une fois le paiement ouvert." />
        ) : (
          <ul className="flex flex-col gap-2">
            {subscriptions.map((subscription) => (
              <li key={subscription.id} className="flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3 text-sm">
                <span className="font-semibold">{subscription.plan?.name ?? "Offre retirée"}</span>
                {subscription.business && <span className="text-ink-muted">· {subscription.business.name}</span>}
                <Badge tone="neutral">{SUBSCRIPTION_STATUSES[subscription.status]}</Badge>
                {subscription.current_period_end && <span className="text-ink-muted">jusqu’au {formatDate(subscription.current_period_end, "short")}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPromotionsPage() {
  return (
    <AdminFrame title="Mises en avant et abonnements">
      <Promotions />
    </AdminFrame>
  );
}
