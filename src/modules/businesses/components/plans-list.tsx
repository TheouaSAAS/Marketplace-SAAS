import { Badge } from "@/components/ui/badge";
import { PRO_BADGES } from "../domain/pro";

export interface Plan {
  code: string;
  name: string;
  description: string | null;
  price_xof: number;
  features: string[];
  is_active: boolean;
}

/** Offres du référentiel, présentées sans promesse : aucun paiement tant qu'aucun prestataire n'est configuré. */
export function PlansList({ plans, paymentsEnabled }: { plans: Plan[]; paymentsEnabled: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-control bg-sand-50 p-3 text-sm">
        {paymentsEnabled
          ? "Le paiement en ligne est configuré : le prix est toujours affiché avant toute souscription."
          : "Le paiement en ligne n’est pas ouvert : aucune somme n’est demandée, et aucune option payante ne peut être souscrite pour l’instant. Les offres ci-dessous sont présentées pour information."}{" "}
        Une mise en avant est toujours signalée « {PRO_BADGES.sponsored.label} » ; elle ne change ni la vérification, ni les avis, ni l’ordre de l’annuaire.
      </p>
      {plans.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucune offre n’est encore définie.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.code} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold">{plan.name}</p>
                <Badge tone={plan.is_active ? "success" : "neutral"}>{plan.is_active ? "Disponible" : "Pas encore ouverte"}</Badge>
              </div>
              <p className="text-sm font-semibold">{plan.price_xof === 0 ? "Gratuit" : `${plan.price_xof.toLocaleString("fr-FR")} FCFA`}</p>
              {plan.description && <p className="text-sm text-ink-muted">{plan.description}</p>}
              <ul className="list-disc pl-4 text-sm text-ink-muted">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
