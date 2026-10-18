import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Compass, Pencil } from "lucide-react";
import { href } from "@/config/routes";
import { LAUNCH_CITY } from "@/domain/city";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DeletePlanForm, SavePlanForm } from "@/modules/newcomer/components/plan-actions";
import { PlanBlockCard, PlanBlockContent } from "@/modules/newcomer/components/plan-block";
import { answersFromSearchParams, answersToSearchParams } from "@/modules/newcomer/domain/answers";
import { buildPlan } from "@/modules/newcomer/domain/plan";
import { getSavedNewcomerAnswers } from "@/modules/newcomer/server/queries";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: `Mon plan — Nouveau à ${LAUNCH_CITY.name} ?`,
  robots: { index: false, follow: true },
};

async function PlanContent({ searchParams }: Pick<PageProps<"/nouveau-arrivant/plan">, "searchParams">) {
  await connection();
  const answers = answersFromSearchParams(await searchParams);
  if (!answers) {
    return (
      <EmptyState
        icon={<Compass aria-hidden className="h-6 w-6" />}
        title="Ce plan est incomplet"
        description="Il manque des réponses pour construire votre plan. Reprenez le questionnaire : cela prend deux minutes."
        action={<ButtonLink href={href("newcomerQuestions")}>Répondre au questionnaire</ButtonLink>}
      />
    );
  }

  const plan = buildPlan(answers);
  const query = answersToSearchParams(answers).toString();
  const [{ current }, saved] = await Promise.all([getCityContext(), getSavedNewcomerAnswers()]);
  const savedQuery = saved ? answersToSearchParams(saved.answers).toString() : null;
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Votre situation">
          {plan.summary.map((item) => (
            <li key={item}>
              <Badge tone="brand">{item}</Badge>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href={`${href("newcomerQuestions")}?${query}`} variant="secondary" icon={<Pencil aria-hidden className="h-4 w-4" />}>
            Modifier mes réponses
          </ButtonLink>
          {savedQuery === query ? <Badge tone="success">Enregistré dans votre compte</Badge> : <SavePlanForm query={query} />}
          {saved && <DeletePlanForm />}
        </div>
      </div>

      <Alert tone="info" title="Comment ce plan est construit">
        Il découle uniquement de vos réponses, selon des règles fixes (sans intelligence artificielle), et ne montre que des
        contenus réellement publiés à {current.name}. Chaque étape indique pourquoi elle vous est proposée. Ce plan oriente
        vers des ressources : il ne remplace pas un conseil juridique, financier, médical ou de sécurité.
      </Alert>

      <ol className="flex flex-col gap-5">
        {plan.blocks.map((block, index) => (
          <PlanBlockCard key={block.key} block={block} index={index}>
            {current.id ? (
              <Suspense fallback={<Skeleton className="h-24 w-full" />}>
                <PlanBlockContent block={block} cityId={current.id} now={now} />
              </Suspense>
            ) : null}
          </PlanBlockCard>
        ))}
      </ol>
    </div>
  );
}

export default function NewcomerPlanPage({ searchParams }: PageProps<"/nouveau-arrivant/plan">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: `Nouveau à ${LAUNCH_CITY.name} ?`, href: href("newcomer") }, { label: "Mon plan" }]} />
      <h1 className="text-3xl font-extrabold sm:text-4xl">Votre plan pour bien démarrer à {LAUNCH_CITY.name}</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
