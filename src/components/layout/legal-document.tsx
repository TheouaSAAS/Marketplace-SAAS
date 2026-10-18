import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";

/** Mise en page commune des pages légales, avec avertissement de statut provisoire. */
export function LegalDocument({
  title,
  version,
  updatedAt,
  children,
}: {
  title: string;
  version: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="text-sm text-ink-muted">
            Version {version} — mise à jour le {formatDate(updatedAt)}
          </p>
        </header>
        <Alert tone="warning" title="Document provisoire">
          Ce texte décrit le fonctionnement réel de la plateforme pendant sa phase pilote. Il doit être validé par un
          juriste avant l’ouverture au public. Les mentions « à compléter » attendent des informations officielles.
        </Alert>
        <div className="flex flex-col gap-6 text-[0.9375rem] leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
          {children}
        </div>
      </article>
    </Container>
  );
}

export function ToComplete({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-warning-soft px-1 text-warning">[à compléter : {children}]</mark>;
}
