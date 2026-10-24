import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { listMetadata } from "@/lib/seo";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BUYER_COMMITMENTS, CHARTER_VERSION, SELLER_COMMITMENTS, SHARED_RULES } from "@/modules/trust/domain/charter";

export const metadata: Metadata = listMetadata({
  title: "Charte de confiance",
  description: "Les engagements des annonceurs et des visiteurs pour des échanges sûrs : pas de paiement d’avance, rencontre en lieu public, signalement, recours.",
  path: "/charte-de-confiance",
  searchParams: {},
});

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default function TrustCharterPage() {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Aide", href: href("help") }, { label: "Charte de confiance" }]} />
      <h1 className="text-3xl font-extrabold">Charte de confiance</h1>
      <p>
        Chaque annonceur s’y engage en soumettant une annonce ; chaque visiteur l’accepte avant son premier message. Version {CHARTER_VERSION}.
      </p>
      <Alert tone="warning" title="Texte provisoire">
        Ces engagements de bonne foi seront relus par un juriste avant le lancement public. Ils ne remplacent pas un contrat.
      </Alert>
      <section aria-labelledby="annonceur" className="flex flex-col gap-2">
        <h2 id="annonceur" className="text-xl font-bold">
          L’annonceur s’engage à
        </h2>
        <List items={SELLER_COMMITMENTS} />
      </section>
      <section aria-labelledby="visiteur" className="flex flex-col gap-2">
        <h2 id="visiteur" className="text-xl font-bold">
          Le visiteur s’engage à
        </h2>
        <List items={BUYER_COMMITMENTS} />
      </section>
      <section aria-labelledby="regles" className="flex flex-col gap-2">
        <h2 id="regles" className="text-xl font-bold">
          Règles communes
        </h2>
        <List items={SHARED_RULES} />
      </section>
      <p className="text-sm">
        Au moment de conclure, chaque annonce propose un <strong>accord de transaction</strong> imprimable à remplir et signer ensemble. Un doute ?{" "}
        <Link href={href("report")} className="underline">
          Signalez le contenu
        </Link>
        .
      </p>
    </Container>
  );
}
