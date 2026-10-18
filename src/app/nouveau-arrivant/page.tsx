import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowRight, Clock, Compass, ListChecks, ShieldCheck } from "lucide-react";
import { href } from "@/config/routes";
import { LAUNCH_CITY } from "@/domain/city";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { answersToSearchParams } from "@/modules/newcomer/domain/answers";
import { getSavedNewcomerAnswers } from "@/modules/newcomer/server/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: `Nouveau à ${LAUNCH_CITY.name} ?`,
  description: `Vous arrivez à ${LAUNCH_CITY.name} ? Quelques questions, puis un plan personnalisé : logement, quartiers, services, déplacements, sorties.`,
};

const PROMISES = [
  { icon: Clock, title: "2 minutes", text: "Cinq étapes courtes, modifiables à tout moment." },
  { icon: ListChecks, title: "Un plan concret", text: "Logement, quartiers, services, déplacements, sorties, selon votre situation." },
  { icon: ShieldCheck, title: "Transparent", text: "Chaque conseil dit pourquoi il vous est proposé ; les informations à vérifier sont signalées." },
];

/** Reprise d'un parcours enregistré dans le compte (lit la session). */
async function SavedPlan({ searchParams }: Pick<PageProps<"/nouveau-arrivant">, "searchParams">) {
  const params = await searchParams;
  if (params.supprime) {
    return <Alert tone="success">Votre parcours a été supprimé de votre compte.</Alert>;
  }
  const saved = await getSavedNewcomerAnswers();
  if (!saved) return null;
  return (
    <Alert
      tone="info"
      title="Vous avez un parcours enregistré"
      action={
        <ButtonLink href={`${href("newcomerPlan")}?${answersToSearchParams(saved.answers).toString()}`} size="sm">
          Reprendre mon plan
        </ButtonLink>
      }
    >
      Enregistré le {formatDate(saved.updatedAt)}.
    </Alert>
  );
}

export default function NewcomerPage({ searchParams }: PageProps<"/nouveau-arrivant">) {
  return (
    <Container className="flex max-w-4xl flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: `Nouveau à ${LAUNCH_CITY.name} ?` }]} />
      <Suspense fallback={null}>
        <SavedPlan searchParams={searchParams} />
      </Suspense>

      <header className="flex flex-col gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-accent-100 text-accent-700">
          <Compass aria-hidden className="h-7 w-7" />
        </span>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Nouveau à {LAUNCH_CITY.name} ?</h1>
        <p className="text-lg text-ink-muted">
          Vous arrivez pour travailler, étudier, visiter, vous installer ou entreprendre ? Répondez à quelques questions : nous
          vous orientons vers l’essentiel, à partir des informations réellement publiées sur la plateforme.
        </p>
        <div>
          <ButtonLink href={href("newcomerQuestions")} variant="accent" size="lg">
            Commencer <ArrowRight aria-hidden className="h-5 w-5" />
          </ButtonLink>
        </div>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
            <Icon aria-hidden className="h-6 w-6 text-brand-700" />
            <p className="font-bold">{title}</p>
            <p className="text-sm text-ink-muted">{text}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="bon-a-savoir" className="flex flex-col gap-2 text-sm text-ink-muted">
        <h2 id="bon-a-savoir" className="text-base font-bold text-ink">
          Bon à savoir
        </h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>Aucun compte n’est nécessaire. Vos réponses restent sur votre appareil, sauf si vous choisissez d’enregistrer votre plan.</li>
          <li>Aucune question ne porte sur votre identité, vos revenus ou votre adresse.</li>
          <li>
            Ce parcours oriente vers les ressources de la plateforme : il ne remplace pas un conseil juridique, financier,
            médical ou de sécurité.
          </li>
        </ul>
      </section>
    </Container>
  );
}
