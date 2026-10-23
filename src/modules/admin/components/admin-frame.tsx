import { Suspense, type ReactNode } from "react";
import { href, type RouteKey } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { requireAccount, type Account } from "@/server/auth";
import { canAccess, type Audience } from "../domain/back-office";

/** Gabarit d'une page du back-office : fil d'Ariane, titre et contenu chargé à part. */
export function AdminFrame({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Container className="flex max-w-5xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Administration", href: href("admin") }, { label: title }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {intro && <p className="text-ink-muted">{intro}</p>}
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>{children}</Suspense>
    </Container>
  );
}

const AUDIENCES: Record<Audience, string> = {
  staff: "à l’équipe de modération",
  curator: "à l’équipe locale (éditeurs locaux et administrateurs)",
  team: "à l’équipe de la plateforme",
  admin: "aux administrateurs",
};

export function AccessDenied({ audience }: { audience: Audience }) {
  return (
    <Alert tone="warning" title="Accès réservé">
      Cette page est réservée {AUDIENCES[audience]}.
    </Alert>
  );
}

/** Compte connecté s'il a accès à la page (connexion demandée sinon) ; null s'il n'a pas le rôle requis. */
export async function teamAccount(route: RouteKey, audience: Audience): Promise<Account | null> {
  const account = await requireAccount(href(route));
  return canAccess(account.role, audience) ? account : null;
}
