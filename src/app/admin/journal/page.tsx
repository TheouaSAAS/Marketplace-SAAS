import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { AUDIT_FILTERS, auditLabel, revisionChanges } from "@/modules/admin/domain/back-office";
import { listAuditEntries, listRevisions, type AuditEntry, type Revision } from "@/modules/admin/server/back-office";
import { ACCESS_EVENT_LABELS, listAdminAccess, type AccessEntry } from "@/modules/admin/server/access-log";

export const metadata: Metadata = {
  title: "Journal et historique — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

const REVISION_ACTIONS = { insert: "Création", update: "Modification", delete: "Suppression" } as const;
const TABLE_LABELS: Record<string, string> = {
  listings: "Annonce",
  places: "Lieu",
  events: "Événement",
  business_profiles: "Page professionnelle",
  neighborhoods: "Quartier",
  categories: "Catégorie",
  cities: "Ville",
  sources: "Source",
  plans: "Offre",
  organizations: "Organisation",
  organization_members: "Membre d’équipe",
  guide_articles: "Article du guide",
  reviews: "Avis",
  listing_comments: "Commentaire",
  sponsored_campaigns: "Campagne",
  place_claims: "Revendication",
  business_verification_requests: "Demande de vérification",
  reports: "Signalement",
};

const value = (input: unknown) => (input === null || input === undefined || input === "" ? "—" : typeof input === "string" ? input : JSON.stringify(input));

function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <EmptyState title="Aucune action enregistrée" description="Les décisions sensibles apparaîtront ici." />;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const details = entry.details ?? {};
        const { raison, avant, apres, ...rest } = details;
        return (
          <li key={entry.id} className="rounded-card border border-border bg-surface p-3 text-sm">
            <p className="font-semibold">{auditLabel(entry.action)}</p>
            <p className="text-ink-muted">
              {formatDateTime(entry.created_at)} · par {entry.actor_name ?? (entry.actor_id ? "membre de l’équipe" : "système")} · {TABLE_LABELS[entry.entity_type] ?? entry.entity_type}
            </p>
            {raison !== undefined && <p>Raison : {value(raison)}</p>}
            {(avant !== undefined || apres !== undefined) && (
              <p>
                Avant : {value(avant)} → après : {value(apres)}
              </p>
            )}
            {Object.keys(rest).length > 0 && <p className="break-all text-xs text-ink-muted">{JSON.stringify(rest)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function RevisionList({ revisions, focused }: { revisions: Revision[]; focused: boolean }) {
  if (revisions.length === 0) return <EmptyState title="Aucune modification enregistrée" description={focused ? "Ce contenu n’a pas d’historique." : "Les modifications apparaîtront ici."} />;
  return (
    <ul className="flex flex-col gap-2">
      {revisions.map((revision) => {
        const changes = revisionChanges(revision.before, revision.after);
        return (
          <li key={revision.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{TABLE_LABELS[revision.entity_type] ?? revision.entity_type}</Badge>
              <span className="font-semibold">{REVISION_ACTIONS[revision.action]}</span>
              <span className="text-ink-muted">
                {formatDateTime(revision.changed_at)} · par {revision.author_name ?? (revision.changed_by ? "membre" : "système")}
              </span>
              {!focused && (
                <Link href={href("adminAudit", { query: { type: revision.entity_type, id: revision.entity_id } })} className="underline">
                  Tout l’historique
                </Link>
              )}
            </div>
            {revision.reason && <p>Raison : {revision.reason}</p>}
            {changes.length > 0 && (
              <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Champs modifiés (défilement horizontal)">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-ink-muted">
                      <th scope="col" className="py-1 pr-3 font-semibold">
                        Champ
                      </th>
                      <th scope="col" className="py-1 pr-3 font-semibold">
                        Avant
                      </th>
                      <th scope="col" className="py-1 font-semibold">
                        Après
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.slice(0, 20).map((change) => (
                      <tr key={change.field} className="border-t border-border align-top">
                        <th scope="row" className="py-1 pr-3 font-medium">
                          {change.label}
                        </th>
                        <td className="py-1 pr-3 break-words">{change.before}</td>
                        <td className="py-1 break-words">{change.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function Journal({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminAudit", "team");
  if (!account) return <AccessDenied audience="team" />;
  const params = await searchParams;
  const type = typeof params.type === "string" && params.type in TABLE_LABELS ? params.type : undefined;
  const id = z.uuid().safeParse(params.id).data;
  const action = AUDIT_FILTERS.find((filter) => filter.value === params.action)?.value ?? "";
  const focused = Boolean(type && id);
  const admin = isAdmin(account.role);
  let entries: AuditEntry[] = [];
  let accesses: AccessEntry[] = [];
  let revisions: Revision[];
  try {
    [entries, revisions, accesses] = await Promise.all([
      admin && !focused ? listAuditEntries(action) : Promise.resolve([]),
      listRevisions({ type, id }),
      admin && !focused ? listAdminAccess() : Promise.resolve([]),
    ]);
  } catch (error) {
    logger.error("Journal indisponible", { module: "administration", error });
    return <ErrorState title="Journal momentanément indisponible" description="Réessayez dans quelques instants." />;
  }

  return (
    <div className="flex flex-col gap-8">
      {admin && !focused && (
        <section aria-labelledby="actions" className="flex flex-col gap-3">
          <h2 id="actions" className="text-xl font-bold">
            Actions sensibles
          </h2>
          <nav aria-label="Filtrer les actions" className="flex flex-wrap gap-2">
            {AUDIT_FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={href("adminAudit", { query: { action: filter.value } })}
                aria-current={filter.value === action ? "page" : undefined}
                className={
                  filter.value === action
                    ? "inline-flex min-h-11 items-center rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white"
                    : "inline-flex min-h-11 items-center rounded-pill border border-border bg-surface px-4 text-sm font-semibold hover:bg-sand-100"
                }
              >
                {filter.label}
              </Link>
            ))}
          </nav>
          <AuditList entries={entries} />
        </section>
      )}
      {admin && !focused && (
        <section aria-labelledby="acces" className="flex flex-col gap-3">
          <h2 id="acces" className="text-xl font-bold">
            Accès à l’administration
          </h2>
          <p className="text-sm text-ink-muted">
            Connexions, échecs, refus, second facteur et déconnexions, conservés un an. Ni mot de passe, ni code, ni adresse en clair : un échec
            n’est rattaché à aucun compte, l’origine est une empreinte.
          </p>
          {accesses.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucun accès enregistré.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
              {accesses.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                  <span className="font-semibold">{ACCESS_EVENT_LABELS[entry.event]}</span>
                  <span>{entry.profile?.display_name ?? (entry.event === "echec" ? "compte non identifié" : "compte supprimé")}</span>
                  <span className="text-ink-muted">{formatDateTime(entry.created_at)}</span>
                  {entry.ip_fingerprint && <code className="text-xs text-ink-subtle">origine {entry.ip_fingerprint.slice(0, 8)}</code>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <section aria-labelledby="historique" className="flex flex-col gap-3">
        <h2 id="historique" className="text-xl font-bold">
          {focused ? `Historique : ${TABLE_LABELS[type!]}` : "Dernières modifications des contenus"}
        </h2>
        {focused && (
          <Link href={href("adminAudit")} className="text-sm underline">
            Revenir à toutes les modifications
          </Link>
        )}
        <RevisionList revisions={revisions} focused={focused} />
      </section>
    </div>
  );
}

export default function AdminAuditPage({ searchParams }: PageProps<"/admin/journal">) {
  return (
    <AdminFrame
      title="Journal et historique"
      intro="Chaque modification d’un contenu est conservée avec son auteur, sa date, sa raison et l’état avant et après. Le journal des actions sensibles (comptes, sanctions, signalements, fusions, campagnes) est réservé aux administrateurs."
    >
      <Journal searchParams={searchParams} />
    </AdminFrame>
  );
}
