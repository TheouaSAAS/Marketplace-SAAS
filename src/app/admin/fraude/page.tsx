import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { href } from "@/config/routes";
import { isAdmin } from "@/domain/roles";
import { CONTENT_STATUS_META, type ContentStatus } from "@/domain/content-status";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";

export const metadata: Metadata = {
  title: "Signaux de fraude — administration",
  robots: { index: false, follow: false },
};

const queueSchema = z.array(
  z.object({
    listing_id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    status: z.string(),
    owner_id: z.uuid(),
    created_at: z.string(),
    score: z.number(),
    signals: z.array(z.object({ code: z.string(), label: z.string(), weight: z.number() })),
  }),
);

async function Queue() {
  const account = await teamAccount("adminFraud", "staff");
  if (!account) return <AccessDenied audience="staff" />;
  const supabase = await createSessionSupabaseClient();
  let items: z.infer<typeof queueSchema>;
  try {
    const { data, error } = await supabase!.rpc("fraud_review_queue");
    if (error) throw new Error(error.code);
    items = queueSchema.parse(data);
  } catch (error) {
    logger.error("Signaux de fraude indisponibles", { module: "administration", error });
    return <ErrorState title="Signaux de fraude momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info" title="Une aide à la revue, pas une décision">
        Le score additionne des indices (photo reprise, prix anormal, lien raccourci, paiement d’avance, numéro partagé, rafale de publications, signalements). Il
        ne suspend rien : examinez l’annonce, puis refusez-la, suspendez-la ou laissez-la, avec un motif, depuis les outils habituels.
      </Alert>
      {items.length === 0 ? (
        <EmptyState title="Aucune annonce à risque" description="Les annonces dont le score atteint 3 apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.listing_id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.score >= 5 ? "danger" : "warning"}>Score {item.score}</Badge>
                <Badge tone="neutral">{CONTENT_STATUS_META[item.status as ContentStatus]?.label ?? item.status}</Badge>
                <span className="text-xs text-ink-muted">créée le {formatDateTime(item.created_at)}</span>
              </div>
              <h2 className="font-bold break-words">{item.title}</h2>
              <ul className="list-disc pl-5 text-sm">
                {item.signals.map((signal) => (
                  <li key={signal.code}>
                    {signal.label} <span className="text-ink-muted">(+{signal.weight})</span>
                  </li>
                ))}
              </ul>
              <p className="flex flex-wrap gap-x-4 text-sm">
                {item.status === "published" ? (
                  <Link href={href("listingDetail", { params: { slug: item.slug } })} className="underline">
                    Voir l’annonce
                  </Link>
                ) : (
                  <Link href={href("adminListings")} className="underline">
                    File de modération des annonces
                  </Link>
                )}
                <Link href={href("adminAudit", { query: { type: "listings", id: item.listing_id } })} className="underline">
                  Historique
                </Link>
                {isAdmin(account.role) && (
                  <Link href={href("adminAccounts", { query: { q: item.owner_id } })} className="underline">
                    Compte de l’annonceur
                  </Link>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminFraudPage() {
  return (
    <AdminFrame title="Signaux de fraude" intro="Annonces en attente ou publiées depuis moins de 60 jours dont les indices de fraude atteignent un score de 3.">
      <Queue />
    </AdminFrame>
  );
}
