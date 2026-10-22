import { AlertTriangle } from "lucide-react";
import { displayedVerification, VERIFICATION_META, type VerificationStatus } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { Alert } from "@/components/ui/feedback";
import { ACCESSIBILITY, AUDIENCES, labels, THEMES, TO_CONFIRM, VISIT_DURATIONS, type VisitDuration } from "../domain/attributes";

interface TouristPlace {
  themes: string[];
  audiences: string[];
  visit_duration: string | null;
  accessibility: string[];
  access_conditions: string | null;
  warnings: string | null;
}

/** Infos pratiques d'un lieu touristique : chaque donnée absente est dite « à confirmer localement ». */
export function PracticalInfo({ place }: { place: TouristPlace }) {
  const duration = place.visit_duration && Object.hasOwn(VISIT_DURATIONS, place.visit_duration) ? VISIT_DURATIONS[place.visit_duration as VisitDuration] : null;
  const rows: [string, string | null][] = [
    ["Thèmes", labels(THEMES, place.themes).join(", ") || null],
    ["Public", labels(AUDIENCES, place.audiences).join(", ") || null],
    ["Durée de visite", duration],
    ["Accessibilité", labels(ACCESSIBILITY, place.accessibility).join(", ") || null],
    ["Conditions d’accès", place.access_conditions],
  ];
  return (
    <section aria-labelledby="pratique" className="flex flex-col gap-3">
      <h2 id="pratique" className="text-xl font-bold">
        Infos pratiques
      </h2>
      {place.warnings && (
        <Alert tone="warning" title="Avertissement">
          <span className="flex items-start gap-1.5">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {place.warnings}
          </span>
        </Alert>
      )}
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={value ? undefined : "italic text-ink-muted"}>{value ?? TO_CONFIRM}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Statut, source et date de vérification d'une fiche (gouvernance des données locales). */
export function SourceAndVerification({
  status,
  verifiedAt,
  source,
  now,
}: {
  status: VerificationStatus;
  verifiedAt: string | null;
  source: string | null;
  now: Date;
}) {
  const shown = displayedVerification(status, verifiedAt, now);
  return (
    <section aria-labelledby="verification" className="flex flex-col gap-2">
      <h2 id="verification" className="text-lg font-bold">
        Source et vérification
      </h2>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
        <dt className="text-ink-muted">Statut</dt>
        <dd>
          {VERIFICATION_META[shown].label} — {VERIFICATION_META[shown].publicNote}
        </dd>
        <dt className="text-ink-muted">Source</dt>
        <dd className={source ? undefined : "italic text-ink-muted"}>{source ?? TO_CONFIRM}</dd>
        <dt className="text-ink-muted">Dernière vérification</dt>
        <dd className={verifiedAt ? undefined : "italic text-ink-muted"}>
          {verifiedAt ? formatDate(verifiedAt) : "Pas encore vérifiée par l’équipe locale"}
          {verifiedAt && shown !== status ? " (vérification ancienne, à renouveler)" : ""}
        </dd>
      </dl>
    </section>
  );
}
