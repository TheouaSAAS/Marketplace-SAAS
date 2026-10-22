# Base de données

PostgreSQL 17 (Supabase) avec PostGIS, `unaccent`, `pg_trgm`, `vector`. Schéma : `supabase/migrations/`. Référentiel : `supabase/seed.sql`. Types TypeScript générés : `src/types/database.ts`.

**État (2026-10-18)** : 12 migrations **appliquées** sur le projet `towkxqwdvjdajlohevxt` (eu-west-1) ; référentiel et données de démonstration chargés ; **97 vérifications réussies sur la base réelle** (`npm run db:verify`) ; tâches planifiées `expirer-annonces` et `purger-anti-abus` actives.

Comptes (niveau 3) : `handle_new_user` crée profil, préférences et consentements datés ; `become_professional()` / `become_individual()` (journalisés) ; `export_my_data()` ; `consume_rate_limit()` (clé secrète uniquement) sur `rate_limit_buckets` ; suppression de compte : lieux, paiements, abonnements et campagnes conservés détachés du compte. Configuration d'authentification : `npm run db:auth-config`.

## Outil `scripts/db.mjs`

| Commande | Effet |
| --- | --- |
| `npm run db:status` | Version, extensions, tables, migrations appliquées ou en attente (lecture seule) |
| `npm run db:migrate` | Applique les migrations en attente, chacune dans une transaction (tout ou rien), tracées dans `supabase_migrations.schema_migrations` |
| `npm run db:seed` | Rejoue `supabase/seed.sql` (idempotent) ; `node scripts/db.mjs seed <fichier>` pour un autre fichier |
| `npm run db:verify` | Exécute `supabase/tests/*.sql` : scénarios par rôle dans une transaction **annulée** (aucune trace) |
| `npm run db:types` | Régénère `src/types/database.ts` depuis le schéma réel |

Connexion : `DATABASE_URL` (PostgreSQL direct ou pooler) ou `SUPABASE_ACCESS_TOKEN` (API d'administration en HTTPS). Le jeton donne accès à tout le compte Supabase : le révoquer quand il n'est plus nécessaire.

**Règles** : une migration appliquée n'est jamais modifiée (correctifs = nouvelle migration). Après toute migration : `npm run db:verify` puis `npm run db:types`.

## Rôles (moindre privilège)

| Rôle | Fonction SQL | Peut |
| --- | --- | --- |
| visiteur | (pas de session) | lire les contenus publiés et visibles |
| `user` (membre) | — | publier (en modération), favoris, contacts, avis, candidatures, messagerie |
| `professional` | — | idem + organisations et vitrines |
| `local_editor` | `is_curator()` | créer, corriger, **vérifier** et publier les données locales (lieux, événements, quartiers, guide, sources) |
| `moderator` | `is_staff()` | modérer les contenus des membres, avis, signalements |
| `admin` | `is_admin()` (+ staff, curator) | comptes, suspensions, référentiel, offres ; attribuer les rôles jusqu'à modérateur |
| `superadmin` | `is_superadmin()` | tout, dont attribuer ou retirer admin/superadmin |

Rôles internes d'une organisation : `owner` > `admin` > `editor` > `viewer`. `can_manage_content(auteur, organisation)` = auteur, ou membre `editor` et plus de l'organisation.

## Tables (46, toutes avec RLS)

| Domaine | Tables |
| --- | --- |
| Référentiel | `cities`, `neighborhoods` (noms alternatifs, périmètre facultatif), `categories`, `guide_sections`, `plans`, `platform_settings` |
| Comptes | `profiles`, `user_preferences`, `consents` (historique, ajout seul), `user_devices`, `newcomer_plans`, `saved_searches` |
| Organisations | `organizations`, `organization_members`, `business_profiles` (vitrines) |
| Contenus | `listings`, `places` (établissements et lieux touristiques), `events` (report, annulation), `guide_articles` + `guide_article_versions`, `images` |
| Gouvernance | `sources`, `content_revisions` (avant/après, auteur, raison), `admin_audit_log` |
| Interactions | `favorites`, `listing_likes`, `listing_comments`, `contact_requests`, `contact_reveals` (interne), `conversations`, `conversation_participants`, `messages`, `reviews`, `job_applications`, `reports` (annonce, lieu, événement, vitrine ou commentaire), `guide_suggestions`, `notifications` |
| Compteurs internes | `listing_view_counts`, `listing_view_marks` (prévues pour un compteur de vues, non alimentées à ce jour) |
| Monétisation | `subscriptions`, `payments`, `sponsored_campaigns` |
| IA | `knowledge_documents`, `knowledge_chunks` (embeddings) |
| Anti-abus | `rate_limit_buckets` (empreintes HMAC, purgées toutes les heures) |
| Statistiques | `search_stats` (totaux quotidiens anonymes des recherches, lecture administrateurs, 180 jours) |

## Deux statuts distincts

- **Modération** (`content_status`) : `draft → pending → published / rejected → expired / archived`. Matrice dans `content_transition_allowed()`, identique à `src/domain/content-status.ts` (test).
- **Vérification** (`verification_status`) : `verified`, `pending_validation`, `placeholder`, `archived`, `rejected` sur `places`, `events`, `listings`, `business_profiles`, `neighborhoods`, `guide_articles`. Contrainte : `verified` ⇒ `source_id`, `verified_at`, `verified_by` renseignés. Seuls les éditeurs locaux vérifient ; une modification par l'exploitant fait retomber la donnée en `pending_validation`. Les `placeholder` ne sont visibles du public que si `demo.public_placeholders` est activé.

## Confidentialité

- `listings.location` (précise) est **obligatoire dès la soumission** ; le public lit `location_public`, dérivée selon `public_location_precision` : `exact`, `approximate` (grille de 0,005°, ~550 m), `neighborhood` ou `hidden` (aucune coordonnée).
- Colonnes **illisibles par l'API** (`anon`, `authenticated`) : `listings.location`, `address_text`, `contact_phone`, `contact_whatsapp`, `contact_email` ; `business_profiles.location`, `address_text`. Lecture par l'auteur/organisation/équipe via `listing_private_fields()` et `business_private_location()`.
- **Conséquence pour le code** : jamais `select("*")` sur ces tables, toujours lister les colonnes. Après ajout d'une colonne à ces tables, rappeler `public.grant_public_columns()` dans la migration.
- `payments.provider_payload` illisible ; `consents` non modifiables ; candidatures, messages, favoris, recherches, préférences : propriétaire uniquement.
- Stockage : `media` (public, images ≤ 5 Mo, dossier `<uid>/`) ; `private-media` (privé, PDF et images ≤ 10 Mo, lecture par URL signée).
- Aucune table ne stocke la position des visiteurs (vérifié par test).

## Recherche (niveau 7, migration `20261019000100_search.sql`)

- `search_matches(type, ville, texte, filtres…)` : une seule logique de correspondance pour `annonces`, `lieux`, `professionnels`, `evenements`, `guide`. **SECURITY INVOKER** : règles d'accès et droits par colonne appliqués ; uniquement les contenus publiés (jamais un brouillon, même pour son auteur), annonces non expirées, événements non terminés.
- Texte : mots normalisés (sans accents) recherchés comme préfixes, tous requis (`search_tsquery`), ou correspondance approchée du titre (trigrammes, `<%`) pour les fautes de frappe. Index trigrammes ajoutés sur les titres d'annonces, d'événements et d'articles.
- `search_content(…, tri, limite, décalage)` : page de résultats (identifiants, distance, total) selon des tris publics (pertinence, récent, prix, date, distance) ; `search_counts(…)` : nombre de résultats par type pour les critères communs.
- Distance calculée sur `location_public` pour les annonces et vitrines (jamais la position exacte) ; sans position, aucun filtre de rayon.
- `record_search()` (clé secrète du serveur uniquement) alimente `search_stats` ; `search_anonymize()` masque suites de chiffres et e-mails.
- `saved_searches` : 20 au plus par compte (déclencheur `limit_saved_searches`).

## Fiche d’annonce et messagerie (niveau 8, migrations `20261020000100` et `…000200`)

- États : `listing_is_public` (publiée, active, statut montrable), `listing_is_contactable` (en plus : non indisponible, annonceur non suspendu), `listing_public_state` (expirée ou archivée, sans révéler brouillons ni refus), `listing_public_point` (coordonnées de la position publique).
- `listing_seller` : profil public minimal de l’annonceur (nom affiché, ancienneté, statut professionnel, organisation, nombre d’annonces en ligne).
- `reveal_listing_contact` : renvoie une coordonnée seulement si l’annonceur l’a partagée (`show_phone`, `show_whatsapp`, `show_email`), à un membre connecté non suspendu, 20 par heure au plus ; chaque affichage est tracé dans `contact_reveals` (90 jours).
- Commentaires (`listing_comments`) : sans téléphone ni e-mail (`contains_contact_details`), 10 par heure, réponse réservée à l’annonceur, texte non modifiable après publication, masquage par l’annonceur, modération par l’équipe ; fil public par `listing_comment_thread`.
- Messagerie : `start_listing_conversation` (ouvre ou reprend la conversation, 10 nouvelles par heure), messages limités à 15 par minute et 200 par heure, `my_conversations` et `conversation_header` réservés aux participants ; table `messages` publiée pour le temps réel de Supabase (règles d’accès appliquées).
- Signalements : un seul ouvert par personne et par contenu, 10 par heure.
- Code d’erreur `CP429` : limite atteinte (le message de la base est affiché tel quel).

## Immobilier (niveau 9, migration `20261022000100_real_estate_search.sql`)

- `search_real_estate(ville, catégories, séjour, texte, type, pièces, chambres, surface, meublé, prix, disponibles, confirmées depuis N jours, quartier, équipements, tri, pagination)` : SECURITY INVOKER, annonces publiées et actives seulement ; séjour `short` = prix à la nuit ou à la journée, `long` = le reste.
- `attr_int`, `attr_bool` : lecture sûre des attributs déclarés (valeur mal typée → null, jamais d’erreur).
- Attributs immobiliers reconnus à l’affichage : `type_bien`, `pieces`, `chambres`, `surface_m2`, `salles_de_bain`, `etage`, `meuble`, `equipements` (liste de clés).

## Services de proximité (niveau 10, migrations `20261023000100` à `…000300`)

- Métiers = catégories du référentiel (groupes « services professionnels » et « transport et livraison »), avec `categories.keywords` : synonymes et problèmes courants (« fuite », « clim »…), administrables sans migration.
- `business_profiles` : `services` (30 prestations au plus), `service_area`, `accepts_quotes`, `availability_note` ; `availability_declared_at` est posée par la base (`stamp_business_availability`) quand la note change, jamais par le client.
- `search_professionals(ville, métiers, texte, quartier, vérifiés, disponibles depuis N jours, mode de contact, position, rayon, tri, pagination)` : SECURITY INVOKER, fiches publiées ; ordre public : vérification de moins d’un an, disponibilité déclarée depuis moins de 30 jours, mise à jour la plus récente (ou distance). Aucun critère payant.
- `business_public_point` : position publique (jamais l’exacte si elle est masquée).
- Demande de devis (`contact_requests.kind = 'devis'`) : `details` (prestation, délai, quartier), `consented_at` obligatoire (contrainte `contact_requests_quote_consent`) ; `enforce_quote_rules` refuse un professionnel qui n’accepte pas les devis et limite à 5 demandes par heure (`CP429`).
- `protect_contact_request_content` : le destinataire ne change que le statut (nouvelle, lue, répondue, archivée) ; message, coordonnées et accord restent tels qu’envoyés (`42501`).

## Commerces (niveau 11, migrations `20261024000100_shops.sql` et `…000200_place_point.sql`)

- Vitrine = `places` de type `etablissement` dans une catégorie de commerce. Vues : « Restaurants et gastronomie » et chaque sous-catégorie de « Commerces et boutiques » (dont la nouvelle `auto-moto`) ; une sous-catégorie ajoutée depuis l’administration devient une vue.
- Attributs déclarés : `features` (11 services) et `ambiance` (6 clés), listes fermées vérifiées par contrainte ; `products` (40 au plus) ; `price_level` (budget indicatif 1 à 4).
- Horaires : `opening_hours` au format `{"lun": [["08:00","12:30"]], …}` (`valid_opening_hours`), `opening_hours_verified_at` + `opening_hours_source_id` (source obligatoire). `protect_place_curation` : seule l’équipe locale vérifie des horaires ; toute autre modification les repasse « à confirmer ». Elle seule désigne le gérant (`manager_id`).
- `place_claims` : revendication (lien, présentation, élément vérifiable, téléphone), une en attente par vitrine et par personne, 3 par jour, impossible si la vitrine a déjà un gérant ; décision par `review_place_claim` (éditeurs locaux et administrateurs ; refus motivé ; notification au demandeur ; journal d’administration ; autres demandes closes).
- `place_likes`, `place_engagement` (total public, état personnel), `start_place_conversation` (messagerie vers le gérant seulement) ; `my_conversations` et `conversation_header` renvoient aussi `place_name`, `place_slug`.
- `search_shops` (SECURITY INVOKER) : type, texte (nom, description, produits), quartier, budget maximal, ambiance (au moins une), services (tous), vérifiés, position et rayon ; ordre public : vérification de moins d’un an, horaires vérifiés depuis moins de 180 jours, mise à jour récente (ou distance).
- `sponsored_shops` : 2 vitrines au plus dont la campagne `category` est `active` et en cours ; affichées à part avec l’étiquette « Sponsorisé ». `place_point` : position en coordonnées (carte, itinéraire).

## Tourisme (niveau 12, migration `20261025000100_tourism.sql`)

- Lieux touristiques, activités, hébergements, restaurants et opérateurs = `places` des catégories « Découvrir » ; nouvelle catégorie `excursions-guides` (opérateurs), mots-clés des catégories touristiques.
- Attributs déclarés, listes fermées vérifiées par contrainte : `themes` (9), `audiences` (5), `visit_duration` (4, rang par `visit_duration_rank`), `accessibility` (4) ; textes `access_conditions` et `warnings` (1 000 caractères). Absents → « information à confirmer localement » à l’affichage.
- Source, statut et date de vérification : colonnes de gouvernance du niveau 2 (`source_id`, `verification_status`, `verified_at`, `verified_by`).
- `search_tourism` (SECURITY INVOKER) : catégories, texte, thèmes (au moins un), public (au moins un), durée maximale, budget maximal, accessibilité (toutes), vérifiés, position et rayon (200 km au plus : environs) ; ordre public : vérification de moins d’un an, thèmes couverts, mise à jour récente (ou distance).
- `itinerary_candidates` : lieux publiés et visibles des catégories touristiques, avec attributs et position (300 au plus) — seule matière du créateur d’itinéraire.

## Guide pratique (niveau 13, migrations `20261026000100_guide.sql` et `…000200_category_counts.sql`)

- Rubriques (`guide_sections`, 11, administrables) reliées aux catégories du site par `category_slugs` ; `category_content_counts` compte les contenus publiés et lisibles (sous-catégories comprises) pour ne proposer un lien que si des données existent.
- `save_guide_article` (SECURITY INVOKER, équipe locale) : création ou modification avec note obligatoire, enregistrée avec la version (`guide_article_versions`, via `app.change_reason`). Le texte modifié incrémente la version ; « vérifié » exige une source et la base date et attribue la vérification.
- `guide_article_history` (dates et notes, sans contenu) et `guide_article_credits` (auteur, source, vérificateur) : publics pour un article publié, sinon équipe locale.
- `guide_suggestions` : ouvertes à la création, 5 par jour et par personne, seulement sur un article publié ; l’équipe change le statut et la réponse (`resolution_note`), jamais le message (`protect_guide_suggestion`, `handled_by` posé par la base). Signalement possible (`reports.article_id`).
- Assistant (RAG) : `sync_guide_knowledge` tient `knowledge_documents` à jour pour chaque article publié (lien `/guide/<rubrique>/<article>`, statut de vérification, source) et le découpe en passages de 1 200 caractères au plus (`chunk_text`) ; un article retiré quitte les documents. Les vecteurs seront calculés au niveau 23 ; l’assistant ne lira que les documents vérifiés (règle existante).

## Quartiers (niveau 14, migrations `20261027000100` à `…000400`)

- `neighborhoods` : noms alternatifs (10 au plus), description neutre, `boundary` facultatif (niveau 2) ; ajouts : `steward_id` (responsable de la fiche), `boundary_validated_at`. Statut, source, date et auteur du contrôle : colonnes de gouvernance du niveau 2.
- `save_neighborhood` (équipe locale) : modification de la fiche avec note obligatoire, historisée par `record_revision` (avant / après, raison).
- Périmètres : `neighborhood_boundaries` (brouillon, validé, refusé, remplacé ; lisible par l’équipe seulement, écrit uniquement par fonctions). `propose_neighborhood_boundary` contrôle le GeoJSON (Polygon ou MultiPolygon, valide, 50 km² au plus, à moins de 40 km de la ville) ; `review_neighborhood_boundary` publie (l’ancien passe « remplacé ») ou refuse avec motif ; `clear_neighborhood_boundary` retire le périmètre avec motif. `protect_neighborhood_boundary` interdit toute autre modification du périmètre publié ; chaque étape est au journal d’administration et chaque publication dans l’historique des révisions.
- Lecture : `neighborhood_boundary_geojson` (périmètre publié), `neighborhood_boundary_history` (équipe), `neighborhood_resource_counts` et `neighborhood_overview` (contenus publiés rattachés par `neighborhood_id`, jamais par proximité), `search_tourism` accepte désormais un quartier.

## Carte (niveau 15, migration `20261028000100_map.sql`)

- `map_features(ville, couches, zone ouest/sud/est/nord, quartier, limite)` (SECURITY INVOKER, 500 au plus, 300 demandés par l’interface) : couches immobilier et emploi (annonces), services (fiches pro), commerces et tourisme (lieux), événements à venir. Seules les coordonnées publiables sont lues : `location_public` des annonces et fiches pro (exacte, arrondie à ~550 m, ou absente selon le choix de l’annonceur), position publique des lieux et événements. Chaque élément garde sa couche, son identifiant, son statut de vérification et sa précision ; le quartier est la relation réelle (`neighborhood_id`). Les colonnes `location` des annonces et fiches pro restent illisibles pour le public (vérifié par test).

## Événements (niveau 16, migrations `20261029000100_events.sql` et `…000200_event_point.sql`)

- Catégories (sous-catégories d’« Événements », administrables) : concerts et spectacles, sport, culture et traditions, salons et conférences, et désormais formation et ateliers, communauté et solidarité, tourisme et sorties, autres.
- `search_events` (SECURITY INVOKER) : catégories, période, gratuit ou payant, quartier, texte ; tri par date de début ; jamais un événement terminé (fin, ou début à défaut, avant maintenant).
- `change_event_schedule` (organisateur, son organisation ou l’équipe) : report (nouvelle date à venir) ou annulation, motif obligatoire affiché au public ; l’événement reste publié (pas de retour en modération), `track_event_schedule` conserve la date initiale ; notification aux personnes qui l’ont en favori.
- Publication : un membre ne crée qu’un brouillon ou une proposition « en attente » (règle du niveau 2) ; `notify_event_moderation` notifie l’organisateur de la décision (publication ou refus motivé).
- Tâches planifiées : `archive_past_events` (toutes les heures, archivé 30 jours après la fin), `send_event_reminders` (toutes les 15 minutes, rappel unique dans les 24 h avant le début pour les événements en favori, `event_reminders`).
- `start_event_conversation` (messagerie avec l’organisateur) ; `my_conversations` et `conversation_header` renvoient `event_title`, `event_slug`. `event_point` : position publique (carte, itinéraire).

## Règles en base (déclencheurs)

`enforce_content_rules` (modération + vérification), `validate_content_references` (catégorie, quartier, ville), `validate_organization_assignment` (publier au nom d'une organisation), `protect_profile_privileges` (rôles), `protect_organization_members` (toujours un propriétaire), `enforce_review_rules` (pas d'auto-évaluation ; le professionnel répond sans modifier la note), `validate_job_application` (offre d'emploi publiée et ouverte), `track_event_schedule` (report, annulation motivée), `record_revision` (historique), versionnement du guide, `set_contact_request_recipient`.

Dans une fonction `SECURITY DEFINER`, tester le contexte système avec `is_service_request()`, jamais `is_service_context()` (voir décision D20).

## Données

- `supabase/seed.sql` : San Pedro, 42 catégories, 3 offres, paramètres. `supabase/seeds/quartiers_san_pedro.sql` : 10 quartiers **à valider**.
- `supabase/seeds/demo.sql` : 5 lieux, 4 annonces, 1 événement, 1 article, **tous fictifs** (`placeholder`, titres « Exemple — … », sans téléphone, prix, horaire ni adresse). Suppression : `supabase/seeds/demo_remove.sql`.

## Tâches planifiées (actives, migration `…000800`)

| Tâche | Horaire | Effet |
| --- | --- | --- |
| `expirer-annonces` | chaque heure à :15 | passe en `expired` les annonces arrivées à échéance |
| `purger-anti-abus` | chaque heure à :45 | supprime les empreintes anti-abus de plus de 24 h |
| `purger-statistiques-recherche` | chaque jour à 3 h 30 | supprime les statistiques de recherche de plus de 180 jours |
| `purger-vues-annonces` | chaque jour à 3 h 20 | supprime les marques de vues de plus de 2 jours |
| `purger-coordonnees-consultees` | chaque jour à 3 h 25 | supprime les traces de coordonnées consultées de plus de 90 jours |

## Sauvegardes

Plan gratuit Supabase : sauvegardes quotidiennes limitées. Avant la production : plan avec restauration ponctuelle (PITR) ou `pg_dump` planifié, et restauration testée.
