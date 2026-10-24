/**
 * Charte de confiance et accord de transaction (niveau 26). Texte de travail
 * à faire relire par un juriste avant le lancement : il fixe des engagements
 * de bonne foi et rappelle les précautions, sans remplacer un contrat ni un
 * conseil juridique. Toute nouvelle version change CHARTER_VERSION (les
 * acceptations sont datées et liées à la version).
 */
export const CHARTER_VERSION = "2026-10";

export const SELLER_COMMITMENTS = [
  "Publier uniquement des biens, services ou offres réels, que je suis en droit de proposer.",
  "Décrire honnêtement l’état, le prix et les conditions ; utiliser mes propres photos.",
  "Ne jamais demander d’argent avant une visite, une rencontre ou la remise du bien (acompte, frais de dossier, « réservation »).",
  "Répondre avec respect, ne pas harceler, ne pas utiliser les coordonnées reçues à d’autres fins.",
  "Retirer ou marquer indisponible l’annonce dès qu’elle n’est plus d’actualité.",
] as const;

export const BUYER_COMMITMENTS = [
  "Contacter l’annonceur pour un intérêt réel, avec courtoisie, sans démarchage ni spam.",
  "Ne verser aucune somme avant d’avoir vu le bien, rencontré la personne ou vérifié le service.",
  "Garder les échanges dans la messagerie tant que la confiance n’est pas établie.",
  "Signaler toute annonce ou tout comportement suspect plutôt que de poursuivre l’échange.",
] as const;

export const SHARED_RULES = [
  "La plateforme met en relation : elle n’est pas partie à la transaction, ne perçoit aucun paiement et ne garantit pas les biens.",
  "Rencontre dans un lieu public, en journée ; visite d’un logement avant tout engagement.",
  "Paiement au moment de la remise, contre reçu ; pas de transfert d’argent à un inconnu.",
  "En cas de manquement : signalement, suspension possible du contenu ou du compte, recours ouvert à l’auteur.",
] as const;

/** Vérifications à cocher ensemble au moment de la transaction (accord imprimable). */
export const AGREEMENT_CHECKS = [
  "Le bien ou le service correspond à l’annonce (état, quantité, caractéristiques).",
  "L’identité du vendeur ou du bailleur a été vérifiée (pièce d’identité présentée).",
  "Pour un logement : le bien a été visité ; le propriétaire ou son mandataire est identifié.",
  "Pour un véhicule : papiers du véhicule présentés et conformes au vendeur.",
  "Le paiement se fait à la remise, contre ce document signé ou un reçu.",
] as const;

export const AGREEMENT_DISCLAIMER =
  "Modèle indicatif proposé par la plateforme pour formaliser un accord entre particuliers ou professionnels. Il ne remplace ni un contrat de bail ou de vente conforme au droit ivoirien, ni l’avis d’un professionnel du droit. À faire relire avant tout usage engageant.";
