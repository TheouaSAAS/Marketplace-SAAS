# Gouvernance des données locales

Principe : **la plateforme ne présente jamais comme un fait une information locale non vérifiée.** Une absence d'information vaut mieux qu'une information inventée.

## Ce qui est une « donnée locale »

Toute information sur le monde réel de la ville : lieux, commerces, adresses, horaires, prix, téléphones, quartiers et leurs limites, lieux touristiques, conditions d'accès, transports, événements, disponibilités, notes et avis, articles du guide.

Ne relèvent pas de cette gouvernance (mais de la modération, voir plus bas) : les annonces déposées par leurs auteurs, qui engagent la responsabilité de l'annonceur.

## Statuts de vérification

| Statut | Sens | Visible du public | Présentation |
| --- | --- | --- | --- |
| `verified` | Information contrôlée par l'équipe | Oui | Badge « Vérifié », date et source affichées |
| `pending_validation` | Saisie, en attente de contrôle | Selon le contexte, jamais comme certaine | Badge « À vérifier », mention « information à confirmer localement » |
| `placeholder` | Exemple de démonstration | Non en production ; en démo seulement | Badge « Exemple / à valider localement » |
| `archived` | Plus d'actualité | Non (sauf historique) | — |
| `rejected` | Refusée au contrôle | Non | — |

Règles :
- `verified` exige **une source**, **une date de vérification** et **un responsable de validation** (contrainte en base).
- Une vérification a une durée de validité par type (ex. horaires : 6 mois, événements : jusqu'à la date). Passé ce délai, la donnée apparaît « à revérifier » dans l'administration et perd l'affirmation « Vérifié » au public.
- Les statuts `pending_validation` et `placeholder` sont clairement signalés dans l'administration (files dédiées, tableau de bord qualité).
- Les données de démonstration portent toujours le statut `placeholder`, sont regroupées dans un fichier de seed distinct et peuvent être supprimées en une opération.

## Interdits

Ne jamais inventer, ni dans le code, ni dans les seeds, ni par IA : adresses, prix, horaires, téléphones, limites de quartiers, disponibilités, lieux touristiques, événements, notes ou avis. Ne jamais qualifier un quartier (sûr, calme, riche, dangereux…) sans critère administré, sourcé et contrôlé.

## Traçabilité

Pour chaque donnée locale : source (type, référence, URL ou personne), date de collecte, date et auteur de vérification, historique des modifications (avant/après, auteur, date, raison). Les modifications sensibles alimentent le journal d'audit.

## Mise en œuvre en base (niveau 2, vérifiée sur la base réelle)

- Colonnes `verification_status`, `verified_at`, `verified_by`, `source_id`, `verification_note` sur lieux, événements, annonces, vitrines, quartiers et articles du guide ; contrainte : `verified` exige source, date et responsable.
- Table `sources` (type, libellé public, éditeur, URL, date de collecte), lisible par tous, modifiable par les éditeurs locaux.
- Seuls les éditeurs locaux (`local_editor`, `admin`, `superadmin`) changent un statut de vérification ; une modification par l'exploitant fait retomber une donnée vérifiée en `pending_validation`.
- `content_revisions` : historique avant/après, auteur, date et raison (`app.change_reason`) de chaque modification ; lisible par l'équipe seulement.
- Visibilité publique : `verified` et `pending_validation` (affichée « à vérifier ») ; `placeholder` seulement si `demo.public_placeholders` est activé ; `archived` et `rejected` jamais.
- Assistant IA : `knowledge_documents` ne sont lisibles qu'au statut `verified`.

## Outils d'administration (niveau 22)

Corriger, vérifier (avec source), dater, publier, archiver, fusionner des doublons, consulter l'historique ; tableau de bord qualité : contenus expirés, sans source, à revalider, signalés.

## IA

L'IA ne crée aucune donnée locale. Elle ne répond qu'à partir de contenus `verified` (ou, si le contexte l'autorise explicitement, `pending_validation` signalés comme tels), cite ses sources internes et répond « je ne dispose pas d'information vérifiée » en l'absence de source.

## Parcours « Nouveau à San Pedro ? » (niveau 6)

Les conseils du plan sont des textes génériques d'orientation (aucune adresse, aucun prix, aucun horaire, aucun numéro). Les seules données locales affichées sont des contenus publiés en base, avec leur badge ; un bloc dont les contenus ne sont pas vérifiés porte un avertissement, et un bloc sans contenu le dit. Les textes des 17 blocs (`src/modules/newcomer/domain/plan.ts`) sont des choix produit, à relire par une personne connaissant San Pedro.

## Recherche (niveau 7)

La recherche n'affiche que des contenus publiés, chacun avec son type, sa fraîcheur (publication, confirmation, mise à jour ou vérification) et son badge. Le filtre « vérifiés uniquement » applique les mêmes durées de validité que l'affichage (365 jours ; 30 jours pour un événement). L'interprétation du langage courant ne crée aucun critère absent de la phrase ni du référentiel (D41). Les distances d'annonces sont calculées sur la position publique, volontairement approximative, et affichées « environ ».

## Modération (distincte de la vérification)

Les contenus déposés par les utilisateurs (annonces, vitrines, événements) suivent un cycle de **modération** : brouillon → en attente → publié / rejeté → expiré / archivé. Une annonce publiée n'est pas pour autant « vérifiée » : les deux notions sont affichées séparément.

## Données à faire valider localement (état actuel)

| Donnée | Fichier | Statut |
| --- | --- | --- |
| Centre approximatif de San Pedro (position par défaut de la carte) | `src/domain/city.ts`, `supabase/seed.sql` | à confirmer |
| 10 noms de quartiers | `supabase/seeds/quartiers_san_pedro.sql` | à valider (orthographe, découpage, manquants) |
| Taxonomie des catégories | `supabase/seed.sql` | choix produit, modifiable |
| Textes des conseils du parcours nouvel arrivant (17 blocs) | `src/modules/newcomer/domain/plan.ts` | à relire localement |
| Rubriques du guide (11) | migration `…000500_domains.sql` | choix produit, modifiable |
| Mots-clés des 5 types de commerces et de la vue « Auto, moto et pièces » (« maquis », « garba », « pagne »…) | migration `20261024000100_shops.sql` | choix produit, à compléter localement |
| Horaires des commerces | saisis et vérifiés par l’équipe locale, avec une source (`sources`) | aucun horaire en démonstration ; « à confirmer » tant qu’ils ne sont pas vérifiés |
| 12 métiers de services et leurs mots-clés (vocabulaire local : « clim », « tresses »…) | migration `20261023000100_services.sql` (`categories.keywords`) | choix produit, à compléter avec les termes utilisés à San Pedro |
| Données de démonstration (5 lieux, 4 annonces, 1 événement, 1 article, 3 fiches professionnelles, 2 vitrines de commerce supplémentaires « Exemple — … », sans horaire) | `supabase/seeds/demo.sql` | `placeholder`, à supprimer avant le lancement (`demo_remove.sql`) ou masquer (`demo.public_placeholders`) |
