import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Link from "next/link";
import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = listMetadata({
  title: "Signaler un contenu",
  description: "Signaler une annonce frauduleuse, une information erronée ou un contenu inapproprié.",
  path: "/signaler",
  searchParams: {},
});

export default function ReportPage() {
  return (
    <InfoPage
      title="Signaler un contenu"
      intro="Vous avez repéré une arnaque, une information fausse ou un contenu inapproprié ? Votre signalement aide toute la communauté."
    >
      <section>
        <h2>Comment signaler</h2>
        <p>
          Chaque annonce, fiche, événement, avis et message comporte un bouton <strong>« Signaler »</strong>. Choisissez le
          motif — arnaque, contenu inapproprié, doublon, information erronée ou autre — et ajoutez un détail si besoin.
        </p>
        <Alert tone="info">
          Les fiches et annonces étant en cours d’ouverture, le bouton « Signaler » apparaîtra avec elles. D’ici là,{" "}
          <Link href={href("contact")} className="font-semibold underline">
            contactez-nous
          </Link>
          .
        </Alert>
      </section>

      <section>
        <h2>Ce qui se passe ensuite</h2>
        <ul>
          <li>Le signalement est examiné par l’équipe de modération, et non par l’auteur du contenu.</li>
          <li>Selon le cas, le contenu est corrigé, suspendu ou retiré, et son auteur est informé du motif.</li>
          <li>Les décisions sont prises par une personne : aucun outil automatique ne sanctionne seul.</li>
          <li>Votre identité n’est jamais communiquée à l’auteur du contenu signalé.</li>
        </ul>
      </section>

      <section>
        <h2>En cas d’urgence ou d’infraction</h2>
        <p>
          Si vous êtes victime d’une escroquerie ou d’une menace, adressez-vous aussi aux services de police ou de
          gendarmerie. Un signalement sur la plateforme ne remplace pas une plainte.
        </p>
      </section>
    </InfoPage>
  );
}
