import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { VERIFICATION_VALIDITY_DAYS } from "@/domain/verification";
import { SponsoredBadge, StatusBadge } from "@/components/ui/badge";
import { FreshnessNote, VerificationBadge } from "@/components/ui/verification";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = {
  title: "Comment nous vérifions les informations",
  description: `Statuts de vérification, sources et dates sur ${SITE.name} : ce qui est contrôlé, ce qui ne l’est pas.`,
};

export default function VerificationPolicyPage() {
  return (
    <InfoPage
      title="Comment nous vérifions les informations"
      intro="Une information locale fiable vaut mieux qu’une page pleine. Voici comment lire chaque fiche."
    >
      <section>
        <h2>Les statuts que vous verrez</h2>
        <ul className="flex flex-col gap-3 [&>li]:ml-0 [&>li]:list-none">
          <li className="flex flex-col gap-1">
            <VerificationBadge status="verified" className="self-start" />
            <span>
              L’équipe locale a contrôlé l’information. La fiche indique toujours la <strong>date de vérification</strong> et
              la <strong>source</strong> (relevé sur le terrain, source officielle, déclaration de l’exploitant…).
            </span>
            <FreshnessNote status="verified" verifiedAt="2026-10-12T10:00:00Z" source="Relevé terrain (exemple d’affichage)" />
          </li>
          <li className="flex flex-col gap-1">
            <VerificationBadge status="pending_validation" className="self-start" />
            <span>Information déclarée, pas encore contrôlée. Elle peut être utile, mais confirmez-la avant de vous déplacer.</span>
          </li>
          <li className="flex flex-col gap-1">
            <VerificationBadge status="placeholder" className="self-start" />
            <span>Donnée de démonstration fictive, présente pendant la phase de lancement. Ne vous y fiez pas.</span>
          </li>
        </ul>
      </section>

      <section>
        <h2>Une vérification a une durée de vie</h2>
        <p>
          Un horaire ou un prix change. Passé un délai, une information vérifiée redevient « À vérifier » jusqu’au prochain
          contrôle : horaires {VERIFICATION_VALIDITY_DAYS.opening_hours} jours, prix {VERIFICATION_VALIDITY_DAYS.prices} jours,
          autres informations {VERIFICATION_VALIDITY_DAYS.default} jours.
        </p>
      </section>

      <section>
        <h2>Annonces : modérées, pas garanties</h2>
        <p>
          Chaque annonce est relue avant publication <StatusBadge status="published" />, et de nouveau après chaque
          modification. Cette relecture vérifie le respect des règles, pas l’existence du bien : le contenu reste sous la
          responsabilité de l’annonceur.
        </p>
      </section>

      <section>
        <h2>Contenus sponsorisés</h2>
        <p>
          Une mise en avant payante est toujours signalée <SponsoredBadge />. Elle ne rend pas une information plus fiable et
          n’influence pas son statut de vérification.
        </p>
      </section>

      <section>
        <h2>Ce que nous n’inventons jamais</h2>
        <p>
          Adresses, horaires, prix, téléphones, limites de quartiers, disponibilités, événements, notes et avis : si une
          information manque, la fiche l’indique (« information à confirmer localement ») au lieu de la deviner. Notre
          assistant suit la même règle : sans source vérifiée, il le dit.
        </p>
      </section>

      <section>
        <h2>Corriger une information</h2>
        <p>
          Chaque correction est historisée (auteur, date, raison). Si vous constatez une erreur, utilisez « Signaler » sur la
          fiche concernée.
        </p>
      </section>
    </InfoPage>
  );
}
