import Link from "next/link";
import { href } from "@/config/routes";
import { Badge } from "@/components/ui/badge";
import { PRO_BADGES, type ProBadge } from "../domain/pro";

/**
 * Badges d'un professionnel, chacun avec sa définition (infobulle) ; le lien
 * mène aux définitions publiques. « Vérifié » est affiché par le badge de
 * vérification commun : il n'est jamais déclaratif.
 */
export function ProBadgeList({ badges, withLegend = false }: { badges: ProBadge[]; withLegend?: boolean }) {
  if (badges.length === 0) return null;
  return (
    <>
      {badges.map((badge) => (
        <Badge key={badge} tone={PRO_BADGES[badge].tone} title={PRO_BADGES[badge].definition}>
          {PRO_BADGES[badge].label}
        </Badge>
      ))}
      {withLegend && (
        <Link href={`${href("verificationPolicy")}#badges`} className="text-xs text-ink-muted underline">
          Que signifient ces badges ?
        </Link>
      )}
    </>
  );
}
