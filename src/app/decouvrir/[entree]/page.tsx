import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { isTourismEntry, TOURISM_ENTRIES } from "@/modules/tourism/domain/entries";
import { TourismExplorer } from "@/modules/tourism/components/tourism-explorer";

type Props = PageProps<"/decouvrir/[entree]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { entree } = await params;
  if (!isTourismEntry(entree)) return { title: "Découvrir", robots: { index: false, follow: true } };
  const entry = TOURISM_ENTRIES[entree];
  return { title: `${entry.title} — San Pedro`, description: entry.intro };
}

export function generateStaticParams() {
  return Object.keys(TOURISM_ENTRIES).map((entree) => ({ entree }));
}

async function Entry({ params, searchParams }: Props) {
  const { entree } = await params;
  if (!isTourismEntry(entree)) notFound();
  const entry = TOURISM_ENTRIES[entree];
  return (
    <>
      <Breadcrumbs items={[{ label: "Découvrir et sortir", href: href("discover") }, { label: entry.title }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{entry.title}</h1>
        <p className="max-w-2xl text-ink-muted">{entry.intro} Une donnée manquante est signalée « à confirmer localement ».</p>
      </div>
      <TourismExplorer searchParams={searchParams} entry={entree} action={href("discoverEntry", { params: { entree } })} />
    </>
  );
}

export default function DiscoverEntryPage(props: Props) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Entry {...props} />
      </Suspense>
    </Container>
  );
}
