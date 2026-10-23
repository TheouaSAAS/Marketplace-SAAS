import Link from "next/link";
import { Briefcase, CalendarClock, MapPin } from "lucide-react";
import { displayedVerification } from "@/domain/verification";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification";
import { CONTRACTS, DOMAINS, ORGANIZATIONS, REMOTE } from "../domain/attributes";
import type { JobCardData } from "../server/queries";

const label = <T extends Record<string, string>>(table: T, value: unknown) => (typeof value === "string" && Object.hasOwn(table, value) ? table[value as keyof T] : null);

/** Carte d'offre : type, employeur, contrat, domaine, lieu, date limite et vérification. */
export function JobCard({ job, now, href }: { job: JobCardData; now: Date; href: string }) {
  const attributes = job.attributes;
  const employer = job.organization?.name ?? job.business?.name ?? job.contact_name ?? label(ORGANIZATIONS, attributes.organisation) ?? "Employeur non précisé";
  const deadline = typeof attributes.date_limite === "string" ? attributes.date_limite : null;
  const tags = [label(CONTRACTS, attributes.contrat), label(DOMAINS, attributes.domaine), label(REMOTE, attributes.teletravail)].filter(Boolean);
  return (
    <article className="relative flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-4 shadow-card has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="neutral">{job.category.name}</Badge>
        <VerificationBadge status={displayedVerification(job.verification_status, job.verified_at, now)} />
      </div>
      <h3 className="line-clamp-2 font-bold leading-snug">
        <Link href={href} className="after:absolute after:inset-0 hover:text-brand-700 focus-visible:outline-none">
          {job.title}
        </Link>
      </h3>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Briefcase aria-hidden className="h-4 w-4 text-brand-700" />
        {employer}
      </p>
      {tags.length > 0 && <p className="text-sm text-ink-muted">{tags.join(" · ")}</p>}
      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1">
          <MapPin aria-hidden className="h-3.5 w-3.5" />
          {job.neighborhood?.name ?? "San Pedro"}
        </span>
        {deadline && (
          <span className="flex items-center gap-1">
            <CalendarClock aria-hidden className="h-3.5 w-3.5" />
            Jusqu’au {formatDate(deadline)}
          </span>
        )}
        {job.published_at && <span>Publiée le {formatDate(job.published_at, "short")}</span>}
      </div>
    </article>
  );
}
