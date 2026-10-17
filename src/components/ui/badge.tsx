import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { CONTENT_STATUS_META, type ContentStatus, type StatusTone } from "@/domain/content-status";

export type BadgeTone = StatusTone | "brand" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-sand-100 text-sand-700 ring-sand-200",
  info: "bg-info-soft text-info ring-brand-100",
  success: "bg-success-soft text-success ring-lagoon-100",
  warning: "bg-warning-soft text-warning ring-yellow-200",
  danger: "bg-danger-soft text-danger ring-red-200",
  brand: "bg-brand-600 text-white ring-brand-600",
  accent: "bg-accent-100 text-accent-700 ring-accent-200",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Statut d'une annonce, d'un lieu ou d'un événement (brouillon, en attente, publiée…). */
export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  const meta = CONTENT_STATUS_META[status];
  return (
    <Badge tone={meta.tone} className={className} title={meta.description}>
      {meta.label}
    </Badge>
  );
}

/** Mention obligatoire des contenus payants (§3.11 : « clairement identifiés »). */
export function SponsoredBadge({ className }: { className?: string }) {
  return (
    <Badge tone="accent" className={className}>
      Sponsorisé
    </Badge>
  );
}

/** Indique qu'une page ou fonctionnalité n'est pas encore disponible. */
export function SoonBadge({ className }: { className?: string }) {
  return (
    <Badge tone="neutral" className={cn("px-2 text-[0.6875rem]", className)}>
      Bientôt
    </Badge>
  );
}
