import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { Faq, InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Aide",
  description: `Questions fréquentes sur ${SITE.name} : compte, publication, vérification des informations, sécurité.`,
};

const LINK = "font-semibold text-brand-700 underline";

export default function HelpPage() {
  return (
    <InfoPage title="Aide" intro="Les réponses aux questions les plus fréquentes sur la plateforme.">
      <section>
        <h2>Utiliser la plateforme</h2>
        <div className="flex flex-col gap-2">
          <Faq question="Faut-il un compte pour consulter le site ?">
            Non. Tout le monde peut consulter les rubriques. Un compte gratuit est nécessaire pour publier, enregistrer des
            favoris, contacter un annonceur et suivre vos démarches.
          </Faq>
          <Faq question="Je viens d’arriver à San Pedro, par où commencer ?">
            Ouvrez <Link href={href("newcomer")} className={LINK}>Nouveau à San Pedro ?</Link> : un parcours court vous
            orientera vers le logement, les services, les déplacements et les sorties selon votre situation.
          </Faq>
          <Faq question="Pourquoi certaines rubriques sont-elles « en préparation » ?">
            La plateforme ouvre progressivement. Plutôt que d’afficher des informations inventées, une rubrique reste vide
            tant que ses contenus n’ont pas été publiés et vérifiés.
          </Faq>
        </div>
      </section>

      <section>
        <h2>Fiabilité des informations</h2>
        <div className="flex flex-col gap-2">
          <Faq question="Que signifient « Vérifié », « À vérifier » et « Exemple » ?">
            « Vérifié » : l’équipe locale a contrôlé l’information, avec une source et une date. « À vérifier » : information
            déclarée, pas encore contrôlée. « Exemple » : donnée de démonstration fictive. Détails dans{" "}
            <Link href={href("verificationPolicy")} className={LINK}>Comment nous vérifions</Link>.
          </Faq>
          <Faq question="Une annonce publiée est-elle vérifiée ?">
            Une annonce est relue par la modération avant publication (règles, contenu interdit), mais son contenu reste
            déclaré par l’annonceur. Vérifiez toujours un bien ou une offre avant de vous engager.
          </Faq>
        </div>
      </section>

      <section>
        <h2>Compte et données</h2>
        <div className="flex flex-col gap-2">
          <Faq question="Je n’ai pas reçu l’e-mail de confirmation.">
            Regardez dans les courriers indésirables. Le lien est valable une heure ; au-delà, connectez-vous ou utilisez{" "}
            <Link href={href("forgotPassword")} className={LINK}>Mot de passe oublié</Link>.
          </Faq>
          <Faq question="Comment exporter ou supprimer mes données ?">
            Depuis <Link href={href("profile")} className={LINK}>Mon profil</Link>, rubrique « Mes données » : export
            complet en un clic, suppression définitive du compte. Voir aussi la{" "}
            <Link href={href("privacy")} className={LINK}>politique de confidentialité</Link>.
          </Faq>
          <Faq question="Ma position est-elle enregistrée ?">
            Non. « Autour de moi » utilise votre position seulement après votre accord. Elle est arrondie à environ 100 m,
            gardée 30 minutes dans votre navigateur, jamais enregistrée par la plateforme ni placée dans l’adresse d’une
            recherche partagée. Sur une annonce,
            le public ne voit qu’une position approximative, le quartier ou rien du tout, selon le choix de l’annonceur.
          </Faq>
        </div>
      </section>

      <section>
        <h2>Sécurité</h2>
        <div className="flex flex-col gap-2">
          <Faq question="Comment éviter les arnaques ?">
            Ne versez jamais d’argent avant d’avoir vu un logement ou un bien, ou rencontré la personne. Méfiez-vous des prix
            anormalement bas et des demandes de paiement urgent. En cas de doute,{" "}
            <Link href={href("report")} className={LINK}>signalez le contenu</Link>.
          </Faq>
        </div>
      </section>

      <p className="text-ink-muted">
        Vous ne trouvez pas votre réponse ? <Link href={href("contact")} className={LINK}>Contactez-nous</Link>.
      </p>
    </InfoPage>
  );
}
