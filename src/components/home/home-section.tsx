import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Info } from "lucide-react";
import { href, type RouteKey } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";

/**
 * Section de l'accueil : titre, lien « Tout voir », règle de sélection en
 * clair (recommandations transparentes), puis contenu, état vide ou erreur.
 */
export function HomeSection({
  id,
  title,
  route,
  rule,
  children,
}: {
  id: string;
  title: string;
  route: RouteKey;
  rule: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-2xl font-bold">
          {title}
        </h2>
        <Link href={href(route)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          Tout voir <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <details className="group -mt-2 text-sm text-ink-muted">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium hover:text-ink [&::-webkit-details-marker]:hidden">
          <Info aria-hidden className="h-4 w-4" />
          Pourquoi ces contenus ?
        </summary>
        <p className="mt-1 max-w-2xl">{rule}</p>
      </details>
      {children}
    </section>
  );
}

export function SectionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

export function SectionUnavailable() {
  return <Alert tone="warning">Ces contenus sont momentanément indisponibles. Réessayez dans quelques instants.</Alert>;
}
