import type { Metadata } from "next";
import Link from "next/link";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { LegalDocument, ToComplete } from "@/components/layout/legal-document";
import { PRIVACY_VERSION } from "@/modules/accounts/domain/schemas";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Données personnelles traitées par ${SITE.name}, finalités, durées de conservation et droits.`,
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Politique de confidentialité" version={PRIVACY_VERSION} updatedAt="2026-10-18">
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          {SITE.name} est édité par <ToComplete>raison sociale, adresse et contact de l’éditeur</ToComplete>. Pour toute
          question relative à vos données : {SITE.contact.email ?? <ToComplete>adresse e-mail de contact</ToComplete>}.
        </p>
        <p>
          Les traitements sont réalisés dans le respect de la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la
          protection des données à caractère personnel. L’autorité de contrôle compétente est l’ARTCI (Autorité de Régulation
          des Télécommunications/TIC de Côte d’Ivoire).
        </p>
      </section>

      <section>
        <h2>Données traitées et finalités</h2>
        <ul>
          <li>
            <strong>Compte</strong> : adresse e-mail, nom affiché, mot de passe (stocké sous forme chiffrée, jamais lisible),
            type de compte. Finalité : créer et sécuriser votre compte.
          </li>
          <li>
            <strong>Contenus publiés</strong> : annonces, fiches, événements, avis, photos. Finalité : les publier et les modérer.
            La position exacte d’une annonce n’est jamais publiée : seule une position arrondie, le quartier ou rien du tout,
            selon votre choix.
          </li>
          <li>
            <strong>Échanges</strong> : messages, demandes de contact, candidatures. Visibles uniquement par leurs participants
            et, en cas de signalement, par l’équipe de modération.
          </li>
          <li>
            <strong>Consentements</strong> : date et version des documents acceptés, choix de communication. Finalité : en
            garder la preuve.
          </li>
          <li>
            <strong>Sécurité</strong> : pour limiter les abus (tentatives de connexion répétées, spam), une empreinte chiffrée et
            non réversible de votre adresse IP est conservée au plus 24 heures. Les journaux techniques masquent les adresses
            e-mail, numéros de téléphone et coordonnées.
          </li>
        </ul>
      </section>

      <section>
        <h2>Géolocalisation</h2>
        <p>
          La fonction « Autour de moi » utilise la position de votre appareil uniquement après votre autorisation explicite,
          pour afficher les résultats proches. Cette position n’est ni enregistrée ni transmise à des tiers, et vous pouvez
          désactiver la fonction à tout moment. Le site reste entièrement utilisable sans elle.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          Le site n’utilise que des cookies nécessaires à son fonctionnement : la session de connexion et la ville que vous avez
          choisie. Aucun cookie publicitaire ni de mesure d’audience tierce n’est déposé.
        </p>
      </section>

      <section>
        <h2>Hébergement et sous-traitants</h2>
        <p>
          Les données sont hébergées par Supabase (base de données, authentification et fichiers) dans un centre de données
          situé en Irlande (Union européenne). <ToComplete>hébergeur du site web et prestataire d’envoi d’e-mails, une fois
          choisis</ToComplete>.
        </p>
      </section>

      <section>
        <h2>Durées de conservation</h2>
        <ul>
          <li>Compte et contenus : jusqu’à la suppression du compte.</li>
          <li>Annonces : retirées automatiquement à leur date d’expiration (60 jours par défaut), puis supprimées avec le compte.</li>
          <li>Paiements : conservés pour les obligations comptables, détachés de votre compte après sa suppression.</li>
          <li>Empreintes anti-abus : 24 heures au plus.</li>
        </ul>
      </section>

      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez à tout moment, depuis{" "}
          <Link href={href("profile")} className="font-semibold text-brand-700 underline">
            votre profil
          </Link>
          : consulter et corriger vos informations, télécharger toutes vos données (export), retirer votre consentement aux
          communications et supprimer définitivement votre compte. Pour toute autre demande ou réclamation, contactez-nous ; vous
          pouvez aussi saisir l’ARTCI.
        </p>
      </section>
    </LegalDocument>
  );
}
