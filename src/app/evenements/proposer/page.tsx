import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ProposeEventForm } from "@/modules/events/components/event-forms";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { requireAccount } from "@/server/auth";
import { getCityContext } from "@/server/city-context";
import { listCategories } from "@/server/repositories/categories";

export const metadata: Metadata = {
  title: "Proposer un événement",
  robots: { index: false, follow: false },
};

async function Proposal() {
  const account = await requireAccount(href("eventPropose"));
  if (account.isSuspended) {
    return (
      <Alert tone="warning" title="Compte suspendu">
        Vous ne pouvez pas proposer d’événement. Contactez l’équipe pour en connaître la raison.
      </Alert>
    );
  }
  const { current } = await getCityContext();
  const [categories, neighborhoods] = await Promise.all([listCategories(), current.id ? listNeighborhoods(current.id) : Promise.resolve([])]);
  const root = categories.find((category) => category.slug === "evenements");
  const eventCategories = root ? categories.filter((category) => category.parent_id === root.id).map(({ id, name }) => ({ id, name })) : [];
  return <ProposeEventForm categories={eventCategories} neighborhoods={neighborhoods.map(({ id, name }) => ({ id, name }))} />;
}

export default function ProposeEventPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Événements", href: href("events") }, { label: "Proposer un événement" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Proposer un événement</h1>
        <p className="text-ink-muted">
          Votre proposition est vérifiée par l’équipe de modération avant publication. Indiquez des informations exactes : un événement fictif ou trompeur est
          refusé.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Proposal />
      </Suspense>
    </Container>
  );
}
