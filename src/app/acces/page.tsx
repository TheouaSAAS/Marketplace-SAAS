import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { enterSiteAction } from "@/server/site-access-action";

export const metadata: Metadata = {
  title: "Accès réservé",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  code: "Ce code n’est pas valable. Vérifiez-le auprès de la personne qui vous a invité.",
  limite: "Trop d’essais. Réessayez dans un quart d’heure.",
};

async function AccessForm({ searchParams }: Pick<PageProps<"/acces">, "searchParams">) {
  const params = await searchParams;
  const next = typeof params.suivant === "string" ? params.suivant : "/";
  const error = typeof params.erreur === "string" ? ERRORS[params.erreur] : undefined;
  return (
    <form action={enterSiteAction} className="flex flex-col gap-4">
      {error && (
        <Alert tone="danger" title="Accès refusé">
          {error}
        </Alert>
      )}
      <input type="hidden" name="suivant" value={next} />
      <Field label="Code d’accès">{(props) => <Input {...props} name="code" type="password" autoComplete="off" required maxLength={200} />}</Field>
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        Entrer
      </button>
    </form>
  );
}

/** Servie à la place des pages quand SITE_ACCESS_CODE est défini (bêta privée, préproduction ; voir proxy). */
export default function SiteAccessPage({ searchParams }: PageProps<"/acces">) {
  return (
    <Container className="flex max-w-md flex-col gap-6 py-16">
      <div className="flex flex-col gap-2">
        <KeyRound aria-hidden className="h-8 w-8 text-brand-700" />
        <h1 className="text-3xl font-extrabold">Accès réservé</h1>
        <p className="text-ink-muted">
          La plateforme est ouverte à un groupe de testeurs avant son lancement. Saisissez le code qui vous a été communiqué.
        </p>
      </div>
      <Suspense fallback={null}>
        <AccessForm searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
