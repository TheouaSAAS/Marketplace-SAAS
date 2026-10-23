import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { MergeForm } from "@/modules/admin/components/back-office-forms";
import { stateLabel } from "@/modules/admin/domain/back-office";
import { listDuplicates, type DuplicatePair } from "@/modules/admin/server/back-office";

export const metadata: Metadata = {
  title: "Doublons de lieux — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;

async function Duplicates({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminDuplicates", "curator");
  if (!account) return <AccessDenied audience="curator" />;
  const merged = (await searchParams).fusion === "ok";
  let pairs: DuplicatePair[];
  try {
    pairs = await listDuplicates();
  } catch (error) {
    logger.error("Doublons indisponibles", { module: "administration", error });
    return <ErrorState title="Détection des doublons momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  return (
    <div className="flex flex-col gap-4">
      {merged && <Alert tone="success">Fiches fusionnées : le doublon est archivé et ses favoris, « j’aime », avis et événements sont rattachés à la fiche conservée.</Alert>}
      {pairs.length === 0 ? (
        <EmptyState title="Aucun doublon probable" description="Les fiches proches au même nom ou au même numéro apparaîtront ici." />
      ) : (
        <ul className="flex flex-col gap-4">
          {pairs.map((pair) => (
            <li key={`${pair.a_id}-${pair.b_id}`} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { name: pair.a_name, slug: pair.a_slug, status: pair.a_status },
                  { name: pair.b_name, slug: pair.b_slug, status: pair.b_status },
                ].map((place) => (
                  <p key={place.slug} className="flex flex-wrap items-center gap-2">
                    <Link href={href("placeDetail", { params: { slug: place.slug } })} className="font-semibold underline break-words">
                      {place.name}
                    </Link>
                    <Badge tone="neutral">{stateLabel(place.status)}</Badge>
                  </p>
                ))}
              </div>
              <p className="flex flex-wrap gap-2 text-sm">
                <Badge tone="info">Noms similaires à {Math.round(pair.similarity * 100)} %</Badge>
                {pair.distance_m !== null && <Badge tone="info">{pair.distance_m} m d’écart</Badge>}
                {pair.same_phone && <Badge tone="warning">Même numéro</Badge>}
              </p>
              <MergeForm a={{ id: pair.a_id, name: pair.a_name }} b={{ id: pair.b_id, name: pair.b_name }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDuplicatesPage({ searchParams }: PageProps<"/admin/doublons">) {
  return (
    <AdminFrame
      title="Doublons de lieux"
      intro="Fiches du même type aux noms très proches (à moins de 300 m) ou au même numéro. Vérifiez avant de fusionner : rien n’est supprimé, la fusion est journalisée."
    >
      <Duplicates searchParams={searchParams} />
    </AdminFrame>
  );
}
