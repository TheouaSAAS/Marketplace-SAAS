import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { SourceForm } from "@/modules/admin/components/back-office-forms";
import { listSources, type Source } from "@/modules/admin/server/back-office";

export const metadata: Metadata = {
  title: "Sources — administration",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  terrain: "Relevé terrain",
  officiel: "Officielle",
  partenaire: "Partenaire",
  declaratif: "Déclarative",
  publication: "Publication",
  autre: "Autre",
};

async function Sources() {
  const account = await teamAccount("adminSources", "curator");
  if (!account) return <AccessDenied audience="curator" />;
  let sources: Source[];
  try {
    sources = await listSources();
  } catch (error) {
    logger.error("Sources indisponibles", { module: "administration", error });
    return <ErrorState title="Sources momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="nouvelle" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="nouvelle" className="text-xl font-bold">
          Nouvelle source
        </h2>
        <SourceForm />
      </section>
      <section aria-labelledby="liste" className="flex flex-col gap-3">
        <h2 id="liste" className="text-xl font-bold">
          Sources enregistrées
        </h2>
        {sources.length === 0 ? (
          <EmptyState title="Aucune source" description="Enregistrez la première source ci-dessus." />
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((source) => (
              <li key={source.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{KIND_LABELS[source.kind] ?? source.kind}</Badge>
                  <span className="font-semibold break-words">{source.title}</span>
                </p>
                <p className="text-ink-muted break-all">
                  Collectée le {formatDate(source.collected_at, "short")}
                  {source.publisher ? ` · ${source.publisher}` : ""}
                  {source.url ? ` · ${source.url}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminSourcesPage() {
  return (
    <AdminFrame
      title="Sources"
      intro="Une donnée n’est « vérifiée » qu’avec une source, une date et un responsable. Les sources sont publiques (intitulé et date) et leur historique est conservé."
    >
      <Sources />
    </AdminFrame>
  );
}
