# Cabine en ligne

Page unique `/cabine` (publique, sans compte) : crédit téléphonique, transfert d’unités, offres Internet, recharge de compteur CIE, transferts entre Wave, Orange Money, Moov Money et MTN MoMo. Administration : `/admin/cabine` (administrateurs avec second facteur).

**État actuel : démonstration uniquement.** Aucun prestataire n’est contractualisé ni intégré : rien n’est payé, rechargé ni transféré, et aucune opération ne peut être « réussie » (contrainte en base). Les frais et totaux affichés sont calculés exactement comme en mode réel.

## Parcours (une seule page, six étapes)

1. Service (quatre familles : crédit et unités, offres Internet, électricité CIE, transfert d’argent).
2. Réseau ou fournisseur (transfert : réseau de départ et d’arrivée ; combinaison non prise en charge signalée).
3. Destinataire : numéro ivoirien à 10 chiffres (01, 05, 07 ; +225 accepté) ou numéro de compteur ; expéditeur pour un transfert. Un préfixe différent du réseau choisi est signalé (portabilité possible).
4. Montant (raccourcis, limites du service) ou offre du catalogue réel (aucune offre inventée : catalogue vide → rien à acheter).
5. Récapitulatif calculé par le serveur et signé (valable 10 minutes) : montant, frais de service, frais du fournisseur, **total à payer**.
6. Confirmation et suivi : référence `CAB-…`, état mis à jour automatiquement jusqu’à un état final.

États affichés : chargement, erreur de validation, paiement en cours, en cours de traitement, en attente de confirmation (« ne relancez pas »), réussie, échouée, annulée, expirée, remboursée.

## Frais

- Taux par service, en points de base (`cabin_service_settings.fee_bps`, 50 = **0,5 %** par défaut), modifiable dans `/admin/cabine`.
- Arrondi : **au franc CFA entier le plus proche, demi-franc vers le haut** (`public.cabin_fee` ; même règle dans `src/modules/cabin/domain/cabin.ts`, testée). Exemple : 10 000 F CFA → 50 F de frais → **10 050 F CFA** à payer.
- Frais du fournisseur affichés séparément, inclus dans le total avant confirmation (aucun tant qu’aucun fournisseur n’est connecté).
- La base recalcule le total à la création de l’opération : s’il diffère de celui confirmé (taux ou offre modifiés entre-temps), l’opération est refusée et le visiteur doit confirmer le nouveau récapitulatif. Aucun frais n’est ajouté après confirmation.

## Sécurité des opérations

- Aucune colonne ni aucun champ pour un code PIN ou un mot de passe : l’autorisation du paiement se fait dans le parcours sécurisé du fournisseur (redirection, USSD push).
- Clés des prestataires : variables d’environnement du serveur seulement (jamais `NEXT_PUBLIC_*`).
- Récapitulatif signé (HMAC) : montant, frais, total et empreinte du destinataire ne peuvent pas être modifiés dans le navigateur.
- Idempotence : chaque confirmation porte une clé ; un double clic ou un renvoi réseau renvoie la même opération (`idempotency_key` unique).
- Limites : 60 récapitulatifs par heure et par adresse IP, 10 opérations par heure par IP et par destinataire.
- États : créée, en attente, en cours, en attente de confirmation, réussie, échouée, annulée, expirée, remboursée ; transitions contrôlées par la base (`cabin_transition_allowed`) ; **« réussie » exige le mode réel, une référence du prestataire et une date de fin** (contrainte) ; une notification répétée n’a aucun effet ; une opération sans confirmation expire au bout d’une heure **sans relance automatique**.
- Résultat incertain (réponse du prestataire non reçue) : « en attente de confirmation », jamais de nouvel envoi automatique.
- Notifications des prestataires : `/api/cabine/notifications/[prestataire]`, signature vérifiée par l’intégration avant tout changement d’état (404 tant qu’aucune intégration n’existe).
- Données personnelles : numéro ou compteur conservés **masqués** (`07 ** ** ** 11`) et sous forme d’empreinte HMAC (limites anti-abus), jamais en clair ni dans les journaux ; le code de recharge CIE n’existe qu’en mode réel et n’est montré qu’au navigateur qui a confirmé l’opération (jeton de suivi dans un cookie protégé) ou au titulaire du compte.
- Accès : opérations lisibles par leur auteur connecté et par les administrateurs (second facteur exigé) ; la modération n’y a pas accès ; aucune écriture directe, tout passe par des fonctions de la base.

## Administration (`/admin/cabine`)

Opérations (filtres « à examiner », en cours, réussies, terminées ; historique de chaque opération ; **rapprochement** avec raison obligatoire et référence du prestataire, journalisé `cabine.rapprochement`), services (activation, taux de frais, limites, prestataire), prestataires (création, activation, suspension, mode réel refusé sans intégration ni clés), réseaux (activation, suspension), combinaisons de transfert (activées seulement avec un prestataire), catalogue des offres Internet (avec l’origine de chaque tarif et sa date de relevé).

## Ajouter un prestataire réel (☐ actions humaines puis code)

1. ☐ Choisir un prestataire **agréé** (établissement de paiement ou de monnaie électronique agréé par la BCEAO, ou agrégateur enregistré) et signer le contrat : services couverts, combinaisons de transfert, frais, plafonds, KYC, remboursements, notifications.
2. ☐ Faire valider par un juriste le statut de la plateforme (simple apporteur d’affaires renvoyant vers le parcours du prestataire, ou activité réglementée) et les obligations associées : identification des clients, LBC/FT, conservation, réclamations, mentions légales, tarifs affichés.
3. ☐ Pour le crédit et les offres Internet : accord de distribution avec les opérateurs ou un distributeur autorisé ; catalogue d’offres fourni par eux.
4. ☐ Pour la CIE : partenaire de vente de recharges prépayées (aucune API publique trouvée) ; format exact du numéro de compteur et du code de recharge.
5. Code : écrire l’intégration dans `src/modules/cabin/server/providers.ts` (`initiate`, `verifyNotification`, `requiredEnv`), avec ses tests ; déclarer ses variables dans `.env.example`, `env:check` et l’hébergeur.
6. `/admin/cabine` : enregistrer le prestataire (mêmes identifiant et services), le rattacher aux services, activer les combinaisons couvertes, passer en mode réel ; essais en préproduction avec de petits montants, rapprochement quotidien avec les relevés du prestataire.

## Points réglementaires relevés (à faire confirmer — ceci n’est pas un avis juridique)

- **Services de paiement dans l’UMOA** : l’instruction BCEAO n° 001-01-2024 du 23 janvier 2024 encadre les services de paiement ; les établissements de paiement doivent être agréés et les agrégateurs enregistrés auprès de la BCEAO ; la période de mise en conformité a été prolongée jusqu’en 2025 ([Cabinet Houda](https://www.avocatshouda.com/uemoa-entree-en-vigueur-de-linstruction-n001-01-2024-relative-aux-services-depaiement-dans-les-etats-membres-de-lumoa/), [Agence Ecofin](https://www.agenceecofin.com/actualites-finance/0304-127221-umoa-les-prestataires-de-paiement-ont-jusqu-au-1er-mai-2025-pour-obtenir-un-agrement), [Trésor public de Côte d’Ivoire](https://tresor.gouv.ci/tres/espace-uemoa-monnaie-electronique-la-bceao-agree-31-nouveaux-etablissements-dont-09-en-cote-divoire/), [rapport BCEAO 2024 sur les services financiers numériques](https://www.bceao.int/sites/default/files/2026-03/Rapport%20annuel%20sur%20les%20services%20financiers%20num%C3%A9riques%20dans%20l'UEMOA%20-%202024.pdf)). Texte officiel à consulter sur le site de la BCEAO.
- **Transferts entre portefeuilles** : la plateforme de paiement instantané de la BCEAO (PI-SPI) relie désormais Wave, Orange Money, MTN et Moov en Côte d’Ivoire ; des sources évoquent la fin de la gratuité de certains transferts interopérables (règles à vérifier auprès de la BCEAO) ([Sika Finance](https://www.sikafinance.com/marches/paiement-instantane-wave-rejoint-un-reseau-desormais-elargi-a-38-participants-en-cote-divoire_64677), [allAfrica](https://allafrica.com/stories/202610050727.html), [Afrique IT News](https://afriqueitnews.com/finance/wave-integre-le-pi-spi-et-la-bceao-cible-desormais-les-paiements-dentreprises/)).
- **Vente de crédit téléphonique** : l’accès des tiers aux API de vente de crédit des opérateurs fait l’objet d’un litige porté devant l’ARTCI (Wave contre les opérateurs) ; aucune décision définitive relevée ([Digital Mag](https://digitalmag.ci/affaire-wave-cote-divoire-contre-les-operateurs-de-telephonie-mobile-que-dit-lartci/), [CIO Mag](https://cio-mag.com/?p=59409)).
- **Recharge CIE** : aucune source publique sur une API ou un programme de partenaires ; se renseigner auprès de la CIE et de l’ANARE-CI.
- Données personnelles : déclaration ou autorisation auprès de l’ARTCI (autorité de protection des données) à vérifier pour ce traitement.
