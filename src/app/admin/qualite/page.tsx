import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { ENTITY_LABELS, QUALITY_KINDS, contentHref, historyHref, isQualityKind, stateLabel, type QualityKind } from "@/modules/admin/domain/back-office";
import { listQualityItems, type QualityItem } from "@/modules/admin/server/back-office";

export const metadata: Metadata = {
  title: "Qualité des données — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

function sinceLabel(kind: QualityKind, item: QualityItem): string | null {
  if (!item.since) return null;
  const date = formatDate(item.since, "short");
  if (kind === "expirees") return `fin de diffusion le ${date}`;
  if (kind === "a_revalider") return `vérifié le ${date}${item.detail ? ` (source : ${item.detail})` : ""}`;
  if (kind === "signales") return `premier signalement le ${date} · ${item.detail} signalement(s)`;
  return `modifié le ${date}`;
}

async function Quality({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminQuality", "team");
  if (!account) return <AccessDenied audience="team" />;
  const params = await searchParams;
  const kinds = (Object.keys(QUALITY_KINDS) as QualityKind[]).filter((kind) => kind !== "signales" || isStaff(account.role));
  const kind: QualityKind = isQualityKind(params.type) && kinds.includes(params.type) ? params.type : "expirees";
  let items: QualityItem[];
  try {
    items = await listQualityItems(kind);
  } catch (error) {
    logger.error("Qualité des données indisponible", { module: "administration", error });
    return <ErrorState title="Tableau de bord qualité momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Catégories de contrôle" className="flex flex-wrap gap-2">
        {kinds.map((item) => (
          <Link
            key={item}
            href={href("adminQuality", { query: { type: item } })}
            aria-current={item === kind ? "page" : undefined}
            className={
              item === kind
                ? "inline-flex min-h-11 items-center rounded-pill bg-brand-600 px-4 text-sm font-semibold text-white"
                : "inline-flex min-h-11 items-center rounded-pill border border-border bg-surface px-4 text-sm font-semibold hover:bg-sand-100"
            }
          >
            {QUALITY_KINDS[item].label}
          </Link>
        ))}
      </nav>
      <p className="text-sm text-ink-muted">{QUALITY_KINDS[kind].explain}</p>
      {items.length === 0 ? (
        <EmptyState title="Rien à signaler" description="Aucun contenu dans cette catégorie." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const link = contentHref(item.entity_type, item.slug);
            const history = historyHref(item.entity_type, item.entity_id);
            const state = stateLabel(item.status);
            return (
              <li key={`${item.entity_type}-${item.entity_id}`} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</Badge>
                  {state && <Badge tone="info">{state}</Badge>}
                  {link ? (
                    <Link href={link} className="font-semibold underline break-words">
                      {item.title}
                    </Link>
                  ) : (
                    <span className="font-semibold break-words">{item.title}</span>
                  )}
                </div>
                <p className="flex flex-wrap gap-x-4 text-ink-muted">
                  {sinceLabel(kind, item) && <span>{sinceLabel(kind, item)}</span>}
                  {history && (
                    <Link href={history} className="underline">
                      Historique
                    </Link>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminQualityPage({ searchParams }: PageProps<"/admin/qualite">) {
  return (
    <AdminFrame title="Qualité des données" intro="Ce qui demande une action pour que les informations sur San Pedro restent justes et sourcées.">
      <Quality searchParams={searchParams} />
    </AdminFrame>
  );
}
