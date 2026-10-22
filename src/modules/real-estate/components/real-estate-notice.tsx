import Link from "next/link";
import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { confirmationFreshness, CONFIRMATION_DAYS, freshnessLabel } from "../domain/freshness";

/**
 * Sur une fiche immobilière : fraîcheur de l'annonce (disponibilité
 * déclarative) et rappel des règles de prudence propres au logement.
 */
export function RealEstateNotice({ lastConfirmedAt, publishedAt, now }: { lastConfirmedAt: string | null; publishedAt: string | null; now: Date }) {
  const freshness = confirmationFreshness(lastConfirmedAt, publishedAt, now);
  const advice = (
    <Link href={href("realEstateAdvice")} className="font-semibold underline">
      Conseils pour se loger
    </Link>
  );
  if (freshness.status === "stale") {
    return (
      <Alert tone="warning" title={freshnessLabel(freshness, Boolean(lastConfirmedAt))}>
        L’annonceur n’a pas confirmé cette annonce depuis plus de {CONFIRMATION_DAYS} jours : le bien a pu être loué ou vendu. Demandez-lui
        s’il est toujours disponible avant de vous déplacer. {advice}
      </Alert>
    );
  }
  return (
    <Alert tone="info" title={freshnessLabel(freshness, Boolean(lastConfirmedAt))}>
      Visitez avant tout versement et demandez un reçu pour chaque paiement. {advice}
    </Alert>
  );
}
