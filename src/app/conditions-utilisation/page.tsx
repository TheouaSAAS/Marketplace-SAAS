import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import { SITE } from "@/config/site";
import { LegalDocument, ToComplete } from "@/components/layout/legal-document";
import { TERMS_VERSION } from "@/modules/accounts/domain/schemas";

export const metadata: Metadata = listMetadata({
  title: "Conditions d’utilisation",
  description: `Règles d’utilisation de ${SITE.name} : comptes, publication, modération, responsabilités.`,
  path: "/conditions-utilisation",
  searchParams: {},
});

export default function TermsPage() {
  return (
    <LegalDocument title="Conditions d’utilisation" version={TERMS_VERSION} updatedAt="2026-10-18">
      <section>
        <h2>Objet</h2>
        <p>
          {SITE.name} est une plateforme d’information locale et de mise en relation : guide de la ville, annonces, commerces,
          services, événements et opportunités. La consultation est libre et gratuite ; la publication, les favoris et les
          échanges nécessitent un compte.
        </p>
      </section>

      <section>
        <h2>Compte</h2>
        <ul>
          <li>Vous fournissez une adresse e-mail valide et gardez votre mot de passe confidentiel.</li>
          <li>Un compte est personnel. Un compte professionnel représente une activité réelle dont vous êtes habilité à parler.</li>
          <li>Vous pouvez supprimer votre compte à tout moment depuis votre profil.</li>
        </ul>
      </section>

      <section>
        <h2>Publication et modération</h2>
        <ul>
          <li>Toute publication est vérifiée par l’équipe de modération avant d’être visible, et à nouveau après chaque modification.</li>
          <li>
            Sont interdits : les contenus illégaux, trompeurs ou frauduleux, les offres discriminatoires, les contenus haineux ou
            violents, l’usurpation d’identité, les doublons et le démarchage abusif.
          </li>
          <li>Une annonce expire automatiquement ; vous pouvez la renouveler.</li>
          <li>L’équipe peut refuser, retirer ou suspendre un contenu ou un compte, en indiquant le motif.</li>
        </ul>
      </section>

      <section>
        <h2>Fiabilité des informations</h2>
        <p>
          Les annonces sont rédigées par leurs auteurs, qui en sont responsables. Les informations locales (lieux, horaires,
          tarifs) indiquent leur statut : « Vérifié » avec date et source, ou « À vérifier ». Les éléments marqués « Exemple » sont
          des démonstrations fictives. Vérifiez toujours les informations importantes avant de vous engager, et ne versez jamais
          d’argent avant d’avoir vu un bien ou rencontré un vendeur.
        </p>
      </section>

      <section>
        <h2>Paiements</h2>
        <p>
          Les offres payantes ne sont pas encore disponibles. Lorsqu’elles le seront, leurs prix et conditions seront affichés
          avant toute souscription, et aucune option ne sera activée sans paiement confirmé.
        </p>
      </section>

      <section>
        <h2>Signalement</h2>
        <p>Chaque contenu peut être signalé. Les signalements sont examinés par l’équipe de modération.</p>
      </section>

      <section>
        <h2>Droit applicable</h2>
        <p>
          Les présentes conditions sont soumises au droit ivoirien. <ToComplete>juridiction compétente et modalités de
          règlement des litiges</ToComplete>.
        </p>
      </section>
    </LegalDocument>
  );
}
