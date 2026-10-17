import type { ReactNode } from "react";
import { Archive, Ban, BadgeCheck, Clock, FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { VERIFICATION_META, type VerificationStatus, type VerificationTone } from "@/domain/verification";

/*
 * Statuts de vérification des données locales. Chaque statut combine couleur,
 * icône ET libellé : jamais la couleur seule (accessibilité, daltonisme).
 * « Exemple » a une bordure pointillée pour se distinguer au premier coup d'œil.
 */

const TONES: Record<VerificationTone, string> = {
  verified: "bg-success-soft text-success ring-1 ring-inset ring-lagoon-100",
  pending: "bg-warning-soft text-warning ring-1 ring-inset ring-yellow-200",
  placeholder: "border border-dashed border-sand-500 bg-surface text-sand-700",
  neutral: "bg-sand-100 text-sand-700 ring-1 ring-inset ring-sand-200",
  danger: "bg-danger-soft text-danger ring-1 ring-inset ring-red-200",
};

const ICONS: Record<VerificationStatus, ReactNode> = {
  verified: <BadgeCheck aria-hidden className="h-3.5 w-3.5" />,
  pending_validation: <Clock aria-hidden className="h-3.5 w-3.5" />,
  placeholder: <FlaskConical aria-hidden className="h-3.5 w-3.5" />,
  archived: <Archive aria-hidden className="h-3.5 w-3.5" />,
  rejected: <Ban aria-hidden className="h-3.5 w-3.5" />,
};

export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const meta = VERIFICATION_META[status];
  return (
    <span
      title={meta.publicNote}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold",
        TONES[meta.tone],
        className,
      )}
    >
      {ICONS[status]}
      {status === "placeholder" ? "Exemple · à valider localement" : meta.label}
    </span>
  );
}

/**
 * Ligne de fraîcheur : « Vérifié le 12 octobre 2026 · Source : Mairie ».
 * Sans vérification, affiche honnêtement « Information à confirmer localement ».
 */
export function FreshnessNote({
  status,
  verifiedAt,
  source,
  className,
}: {
  status: VerificationStatus;
  verifiedAt?: Date | string | null;
  source?: string | null;
  className?: string;
}) {
  const verified = status === "verified" && verifiedAt;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted", className)}>
      <VerificationBadge status={status} />
      <span>
        {verified ? `Vérifié le ${formatDate(verifiedAt)}` : VERIFICATION_META[status].publicNote}
        {source ? ` · Source : ${source}` : ""}
      </span>
    </p>
  );
}

/** Remplace une valeur absente ou non fiable (horaires, prix, téléphone…). */
export function ToConfirm({ label = "Information à confirmer localement", className }: { label?: string; className?: string }) {
  return <span className={cn("text-sm italic text-ink-muted", className)}>{label}</span>;
}
