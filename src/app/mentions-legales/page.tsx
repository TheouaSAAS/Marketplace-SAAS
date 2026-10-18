import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { LegalDocument, ToComplete } from "@/components/layout/legal-document";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Éditeur, hébergement et contact de ${SITE.name}.`,
};

export default function LegalNoticePage() {
  return (
    <LegalDocument title="Mentions légales" version="2026-10" updatedAt="2026-10-18">
      <section>
        <h2>Éditeur</h2>
        <ul>
          <li>
            Nom du service : {SITE.name} — « {SITE.slogan} »
          </li>
          <li>
            Éditeur : <ToComplete>raison sociale ou nom</ToComplete>
          </li>
          <li>
            Forme juridique et immatriculation (RCCM) : <ToComplete>numéro RCCM</ToComplete>
          </li>
          <li>
            Siège : <ToComplete>adresse</ToComplete>
          </li>
          <li>
            Directeur de la publication : <ToComplete>nom</ToComplete>
          </li>
          <li>Contact : {SITE.contact.email ?? <ToComplete>adresse e-mail</ToComplete>}</li>
        </ul>
      </section>
      <section>
        <h2>Hébergement</h2>
        <ul>
          <li>Données (base, authentification, fichiers) : Supabase, centre de données en Irlande (Union européenne).</li>
          <li>
            Site web : <ToComplete>hébergeur, une fois choisi</ToComplete>
          </li>
        </ul>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          Les contenus publiés par les utilisateurs restent leur propriété ; ils accordent à la plateforme le droit de les afficher
          pour les besoins du service. Les éléments graphiques de la marque {SITE.name} ne peuvent être réutilisés sans
          autorisation.
        </p>
      </section>
    </LegalDocument>
  );
}
