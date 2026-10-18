import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Breadcrumbs } from "./breadcrumbs";

/** Mise en page des pages d'information (aide, vérification, signalement, contact). */
export function InfoPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Container className="max-w-3xl py-8 sm:py-12">
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <Breadcrumbs items={[{ label: title }]} />
          <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
          {intro && <p className="text-lg text-ink-muted">{intro}</p>}
        </header>
        <div className="flex flex-col gap-6 text-[0.9375rem] leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
          {children}
        </div>
      </article>
    </Container>
  );
}

/** Question fréquente dépliable (élément natif, accessible sans JavaScript). */
export function Faq({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group rounded-card border border-border bg-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-4 py-3 text-ink-muted">{children}</div>
    </details>
  );
}
