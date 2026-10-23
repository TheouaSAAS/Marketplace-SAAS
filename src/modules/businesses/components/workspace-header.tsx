import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { CONTENT_STATUS_META } from "@/domain/content-status";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { requireAccount } from "@/server/auth";
import { TEAM_ROLES } from "../domain/pro";
import { getWorkspace, type Workspace } from "../server/workspace";

/** Espace d'une page : la personne doit en être membre (sinon 404 : on ne révèle pas l'existence de la page). */
export async function loadWorkspace(params: Promise<{ id: string }>, route: "proWorkspace" | "proListings" | "proInbox" | "proStats" | "proModeration" | "proOffers") {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await requireAccount(href(route, { params: { id } }));
  const workspace = await getWorkspace(id, account.id);
  if (!workspace) notFound();
  return { id, account, workspace };
}

export function WorkspaceHeader({ workspace, section }: { workspace: Workspace; section: string }) {
  const { page, role, isHolder } = workspace;
  return (
    <div className="flex flex-col gap-2">
      <Breadcrumbs items={[{ label: "Espace professionnel", href: href("pro") }, { label: page.name, href: href("proWorkspace", { params: { id: page.id } }) }, { label: section }]} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={CONTENT_STATUS_META[page.status].tone}>{CONTENT_STATUS_META[page.status].label}</Badge>
        <span className="text-sm text-ink-muted">Votre rôle : {isHolder ? "Titulaire" : TEAM_ROLES[role].label}</span>
        {page.status === "published" && (
          <Link href={href("professionalDetail", { params: { slug: page.slug } })} className="text-sm font-semibold underline">
            Voir la page publique
          </Link>
        )}
      </div>
      <h1 className="text-3xl font-extrabold">
        {page.name} <span className="sr-only">— {section}</span>
      </h1>
    </div>
  );
}
