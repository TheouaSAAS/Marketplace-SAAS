import type { Metadata } from "next";
import { Suspense } from "react";
import { href } from "@/config/routes";
import { LAUNCH_CITY } from "@/domain/city";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NewcomerWizard } from "@/modules/newcomer/components/newcomer-wizard";
import { answersFromSearchParams } from "@/modules/newcomer/domain/answers";
import { isFeatureEnabled } from "@/server/features";

export const metadata: Metadata = {
  title: "Questionnaire — Nouveau à San Pedro ?",
  robots: { index: false, follow: true },
};

/** Les réponses présentes dans l'adresse (« Modifier mes réponses ») préremplissent le questionnaire. */
async function Wizard({ searchParams }: Pick<PageProps<"/nouveau-arrivant/questions">, "searchParams">) {
  const initial = answersFromSearchParams(await searchParams);
  return <NewcomerWizard initialAnswers={initial} aiEnabled={isFeatureEnabled("ai_assistant")} />;
}

export default function NewcomerQuestionsPage({ searchParams }: PageProps<"/nouveau-arrivant/questions">) {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: `Nouveau à ${LAUNCH_CITY.name} ?`, href: href("newcomer") }, { label: "Questionnaire" }]} />
      <h1 className="text-3xl font-extrabold">Parlez-nous de votre arrivée</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Wizard searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
