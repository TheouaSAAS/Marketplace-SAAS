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

## Modération (distincte de la vérification)

Les contenus déposés par les utilisateurs (annonces, vitrines, événements) suivent un cycle de **modération** : brouillon → en attente → publié / rejeté → expiré / archivé. Une annonce publiée n'est pas pour autant « vérifiée » : les deux notions sont affichées séparément.

## Données à faire valider localement (état actuel)

| Donnée | Fichier | Statut |
| --- | --- | --- |
| Centre approximatif de San Pedro (position par défaut de la carte) | `src/domain/city.ts`, `supabase/seed.sql` | à confirmer |
| 10 noms de quartiers | `supabase/seeds/quartiers_san_pedro.sql` | à valider (orthographe, découpage, manquants) |
| Taxonomie des catégories | `supabase/seed.sql` | choix produit, modifiable |
| Rubriques du guide (11) | migration `…000500_domains.sql` | choix produit, modifiable |
| Données de démonstration (5 lieux, 4 annonces, 1 événement, 1 article) | `supabase/seeds/demo.sql` | `placeholder`, à supprimer avant le lancement (`demo_remove.sql`) ou masquer (`demo.public_placeholders`) |
