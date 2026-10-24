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

## Emploi et opportunités (niveau 17, migrations `20261030000100_jobs.sql` à `…000300_listing_availability.sql`)

- Catégorie `missions-freelance` ajoutée ; une offre (schémas `emploi`, `opportunite`, `appel_offres`, `formation`) n’exige pas de position (`require_listing_location` remplace la contrainte `listings_location_required`) : aucune adresse inventée.
- `apply_listing_deadline` (`listings_zz_deadline`) : la date limite (`attributes.date_limite`) fixe l’expiration au lendemain ; une date passée est refusée.
- `validate_job_application` : candidature interne seulement, sur une offre publiée, ouverte, non expirée et dont la date limite n’est pas passée. `protect_job_application` : seul le statut change ; le candidat ne peut que retirer ; l’employeur décide (vue, retenue, non retenue) et le candidat est notifié. `notify_job_application` notifie l’employeur. `received_applications()` : candidatures reçues avec le nom du candidat.
- `candidate_profiles` : visibilité `private` (défaut), `employers` (comptes professionnels, `is_employer()`) ou `public` ; coordonnées jamais lisibles directement (droits de colonnes) : `my_candidate_contact()` pour soi, `reveal_candidate_contact(uuid)` pour un employeur qui voit le profil et seulement si le candidat partage.
- `search_jobs` (SECURITY INVOKER) : ville, types, texte, contrat, domaine, expérience, ancienneté, quartier, télétravail, type d’organisation ; offres ouvertes seulement.
- `notify_listing_moderation` : l’auteur d’une annonce (dont une offre) est notifié de la publication ou du refus motivé.
- `enforce_content_rules` ignore désormais `availability_status` : clôturer une offre ou marquer un bien indisponible ne renvoie pas en modération.

## Publication (niveau 18, migrations `20261031000100_publishing.sql` et `…000200_publishing_editor.sql`)

- Brouillon incomplet : `listings_title_check` et `listings_description_check` n’imposent les longueurs minimales qu’hors brouillon ; la position reste exigée à la soumission (`require_listing_location`).
- Photos : `images.bucket` (`media` public ou `private-media` privé), `content_hash` (SHA-256), `byte_size`. `protect_image` : une photo d’annonce déposée par son auteur est privée d’office, 10 au plus par annonce, et l’auteur ne modifie que la légende et l’ordre ; l’équipe la rend publique à la publication (copie de fichier par le serveur). `listing_image_duplicates(annonce)` : nombre de photos identiques dans d’autres annonces du même compte ou d’un autre, sans détail.
- `listing_suggestions` : suggestions de l’assistant (champ, valeur, origine `regles` ou `ia`, source `texte`, `photo` ou `pdf`, confiance, extrait, modèle), privées (auteur et équipe). `protect_listing_suggestion` : naît « proposée », la valeur ne change jamais, décisions proposée → acceptée ou rejetée, acceptée → annulée, datées ; `previous_value` (valeur remplacée) n’est fixée qu’à l’acceptation.
- `ai_usage` : volumes et coût estimé de chaque appel à l’IA, écrits par le serveur seul (clé secrète) ; lecture administrateurs. `ai_month_cost()` (rôle de service) pour le budget mensuel.
- `listing_editor_point(annonce)` : position privée pour l’auteur ou l’équipe (éditeur, contrôle de soumission).

## Profils professionnels (niveau 19, migrations `20261101000100_pros.sql` à `…000700_team_viewers.sql`)

- `business_profiles` : `faq` (10 questions au plus), `links` (6 liens), `is_claimed` (faux pour une page créée par l’équipe, revendicable) ; colonnes publiques réaccordées (`grant_public_columns`) ; cinq pages au plus par compte (`limit_business_profiles`). La disponibilité, sa date et l’ouverture aux devis changent sans relecture (`enforce_content_rules`). `notify_business_moderation` : décision notifiée.
- Lecture : un membre de l’équipe, même « Lecteur », voit la page non publiée ; modifier reste réservé aux éditeurs et plus. Photos de page privées d’office (12 au plus) ; `can_manage_private_media` ouvre le stockage privé aux membres habilités (lecture, suppression).
- Revendication : `place_claims` accepte une page (`business_id`) ; `review_business_claim` transfère la page au demandeur (équipe locale, journal d’administration, notification).
- Équipe : `organization_invitations` (rôle hors propriétaire, empreinte SHA-256 du lien, 7 jours, révocable) ; `create_organization_invitation` (administrateurs, renvoie le lien une fois), `organization_invitation_preview`, `accept_organization_invitation`, `revoke_organization_invitation`, `organization_team` (noms publics des membres).
- Vérification : `business_verification_requests` (élément vérifiable, une demande en attente par page) ; `decide_business_verification` (équipe locale, source obligatoire créée dans `sources`, journal, notification). `business_public_badges(ids)` : sponsorisé (campagne active) et vérification en attente.
- Avis : `account_can_review` (compte connecté seulement : 7 jours, adresse confirmée) appliqué par `enforce_review_rules`, 5 avis par jour ; `business_reviews`, `business_rating` (publics, sans donnée personnelle hors nom public), `received_business_reviews` (équipe de la page) ; `notify_review_decision`.
- `ai_usage.feature` : `publication` ou `profil_pro`.

## Tableau de bord (niveau 20, migration `20261102000100_dashboard.sql`)

- `user_preferences` : `show_public_name`, `show_member_since`, `show_listing_count`, `search_indexing` (vrais par défaut). `member_privacy` (interne) les lit ; `listing_seller`, `listing_comment_thread` et `business_reviews` affichent « Membre », masquent l’ancienneté ou le nombre d’annonces selon ces choix ; `member_allows_indexing` (public) fait passer les annonces du membre en `noindex`.
- `filter_muted_notification` (avant insertion) : ne crée pas une notification d’une catégorie coupée (`notification_channels -> type ->> 'site' = 'false'`) parmi avis, candidature, équipe, événement, rappel ; les autres types sont toujours créés.
- `my_listing_stats()` : vues, favoris, coordonnées vues, conversations de mes annonces ; `my_listing_history(annonce)` : changements de statut et de disponibilité tirés de `content_revisions` (auteur seulement).

## Espace professionnel (niveau 21, migration `20261103000100_pro_dashboard.sql`)

- `business_view_counts`, `business_view_marks` (illisibles par l’API), `record_business_view` (rôle de service) : un visiteur distinct par jour ; tâche `purger-vues-pages-pro` (empreintes de plus d’un jour). Les vues d’annonces (`record_listing_view`, niveau 8) sont désormais réellement comptées par l’application.
- `is_page_member` (titulaire ou membre de l’équipe), `is_page_manager` (éditeur et plus). Demandes de contact : lecture et statut pour les gestionnaires de la page (`contact_requests_page_select`, `…_update`) ; `protect_contact_request` interdit de modifier leur contenu.
- `validate_listing_business` : rattacher une annonce à une page exige de la gérer.
- `pro_listings`, `pro_events` (membres, tous statuts, avec statistiques par annonce), `pro_stats` (agrégats uniquement), `pro_moderation_history` (changements de statut de la page et de ses annonces, motif des refus).

## Back-office (niveau 22, migrations `20261104000100_back_office.sql` à `…000300_admin_set_account_defaults.sql`)

- `audit_account_change` (déclencheurs `profiles_audit`, `organizations_audit`) : tout changement de rôle ou de suspension est inscrit au journal `admin_audit_log` (auteur, raison transmise par `app.change_reason`, avant, après), quel que soit le chemin.
- Historique (`record_revision`) étendu à `reviews`, `listing_comments`, `sponsored_campaigns`, `place_claims`, `business_verification_requests` et aux décisions sur `reports`.
- Comptes : `admin_accounts` (recherche, adresse e-mail lue dans `auth.users`), `admin_set_account` (droits de l’appelant : `protect_profile_privileges` s’applique ; raison obligatoire ; jamais son propre compte), `admin_organizations`, `admin_set_organization` — administrateurs seulement.
- Signalements : `admin_reports` (contenu visé, compte responsable, nombre de signalements ouverts), `handle_report` (examen, sans suite, traité, suspension : contenu refusé avec motif ou masqué, auteur notifié en catégorie `moderation`, signalements du même contenu clos, journal) — équipe de modération.
- Tableau de bord : `admin_overview` (volumes), `quality_items` (expirées, sans source, à revalider, signalées), paramètre `verification.revalidate_months` (12) lu par `revalidation_threshold()`.
- Journal : `admin_audit_entries` (administrateurs), `admin_revisions` (équipe), avec le nom de l’auteur.
- Doublons : colonne `places.merged_into`, index trigramme sur le nom, `place_duplicates` et `merge_places` (éditeurs locaux ; doublon archivé, jamais supprimé).
- Mises en avant : `admin_set_campaign_status` (pause, arrêt, refus ; activation impossible sans paiement).

## Couche IA (niveau 23, migration `20261105000100_ai_layer.sql`)

- Base de connaissances : `put_knowledge` (interne) et déclencheurs `places_knowledge`, `neighborhoods_knowledge`, `events_knowledge` (en plus du guide) : seuls les contenus publiés ET vérifiés y entrent, en sortent dès qu'ils perdent ce statut ; tâche `purger-connaissances-evenements` (événements passés).
- `knowledge_chunks.search_vector` (français, sans accents, index GIN) ; `search_knowledge(question, limite)` : passages des documents vérifiés seulement, avec titre, adresse interne, date de vérification et source.
- `ai_usage.feature` : `publication`, `profil_pro`, `assistant`, `recherche`, `moderation` ; `ai_usage_summary()` (administrateurs) ; aucune colonne de contenu.
- Interrupteur `ai.kill_switch` (`platform_settings`), basculé par `set_ai_kill_switch` (administrateurs, raison obligatoire, journalisé `ia.arret` / `ia.reprise`).

## Notifications (niveau 24, migration `20261106000100_notifications.sql`)

- `notifications.dedupe_key` (unique par personne) : une alerte, un rappel ou une relance n'est créé qu'une fois.
- `notification_category(type)` : `decisions` (annonce, page pro, modération, revendication, vérification) ou le type lui-même ; `filter_muted_notification` coupe sur le site toute catégorie sauf `decisions`.
- `notification_deliveries` : file d'envoi (un envoi par notification et par canal), alimentée par `enqueue_notification_delivery` selon `notification_channels` (`<catégorie>.email`, `_email.off`) et seulement vers une adresse confirmée ; illisible des membres (administrateurs : lecture). `claim_notification_deliveries` (réserve sans doublon, reprend un envoi bloqué depuis 10 min) et `complete_notification_delivery` (nouvel essai à 2, 4, 8, 16 min, abandon au 5e échec) : rôle de service.
- Déclencheurs `messages_notify` (une notification non lue par conversation, sans le texte du message) et `contact_requests_notify`.
- `notify_expiring_listings` (tâche `relancer-annonces-expirant`, 8 h 40) ; `confirm_listing` (auteur, 7 derniers jours : prolonge sans repasser en modération) ; `send_event_reminders` réécrite (conditionnel si l'événement n'est pas vérifié, dédoublonnée) ; `record_search_alert` (rôle de service).

## Sécurité et anti-fraude (niveau 26, migration `20261107000100_security.sql`)

- `user_blocks` (propriétaire seul) et `enforce_message_blocks` : un membre bloqué ne peut plus écrire à celui qui l'a bloqué.
- `appeals` : recours (un seul en cours par contenu) ; `submit_appeal` (auteur, contenu refusé, masqué ou compte suspendu, 5 par jour), `decide_appeal` (équipe ; accepté : contenu renvoyé en relecture ou rétabli, compte réactivé par un administrateur seulement ; notification, journal `recours.*`), `admin_appeals`.
- `fraud_signals_for` (calcul interne, non exposé), `listing_fraud_signals` (équipe), `fraud_review_queue` (score ≥ 3), alerte `listings_fraud_alert` (score ≥ 5 : notification `securite` à l'équipe). Aucun de ces éléments ne modifie un contenu.
- `charter_acceptances` : acceptation datée de la charte par rôle et version, en son nom seulement et au moment présent.

## Rubriques des annonces et temps réel (migrations `20261108000100` à `…000300`)

- `categories.attribute_fields` : champs du modèle de fiche activés pour la catégorie (null : tous).
- `protect_category_tree` (déclencheur) : quatre niveaux au plus, même famille, pas de cycle, y compris pour les sous-catégories d'une catégorie déplacée.
- `admin_category_usage()` (administrateurs) : sous-catégories, annonces publiées et autres, lieux, événements, pages pro par catégorie.
- `delete_category(catégorie, reprise, raison)` (administrateurs) : refuse s'il reste des sous-catégories ; déplace annonces, lieux, événements, pages pro et campagnes vers la catégorie de reprise (active, même famille) ; journal `categorie.suppression`.
- `search_listings(...)` (invocateur, anon et membres) : annonces publiées, non expirées et visibles de toutes les rubriques hors emploi ; filtres ville, quartier, catégories, prix, disponibilité, caractéristiques exactes (`p_eq`), textes sans casse ni accents (`p_text`), bornes (`p_min`, `p_max` : une annonce sans la caractéristique est exclue, correctif `…000200`) ; tri récent, prix croissant ou décroissant, pertinence ; total avant pagination.
- `broadcast_listing_change` (déclencheur) : diffuse `{ id }` sur le canal public `annonces` (événement `annonce`) quand une annonce visible change ; ignore les compteurs ; un échec de diffusion ne bloque pas l'écriture. Les partitions quotidiennes de `realtime.messages` sont créées par le service Realtime de Supabase tant qu'il est actif.
- Référentiel livré : Biens et objets (9 sous-rubriques), Véhicules (6 sous-rubriques), modèles `bien`, `vehicule`, `piece`.

## Règles en base (déclencheurs)

`enforce_content_rules` (modération + vérification), `validate_content_references` (catégorie, quartier, ville), `validate_organization_assignment` (publier au nom d'une organisation), `protect_profile_privileges` (rôles), `protect_organization_members` (toujours un propriétaire), `enforce_review_rules` (pas d'auto-évaluation ; le professionnel répond sans modifier la note), `validate_job_application` (offre publiée, ouverte, date limite non passée), `protect_job_application`, `apply_listing_deadline`, `require_listing_location`, `notify_listing_moderation`, `protect_image` (photos privées d’office, limite, champs protégés), `protect_listing_suggestion` (décisions tracées), `filter_muted_notification` (catégories coupées), `protect_contact_request` (statut seul), `validate_listing_business` (annonce au nom d’une page), `track_event_schedule` (report, annulation motivée), `record_revision` (historique), `audit_account_change` (journal des rôles et suspensions), `enforce_message_blocks` (blocage), `alert_risky_listing` (alerte anti-fraude), versionnement du guide, `set_contact_request_recipient`.

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
| `purger-vues-pages-pro` | chaque jour à 3 h 22 | supprime les empreintes de vues des pages pro de plus d’un jour |
| `purger-connaissances-evenements` | chaque jour à 3 h 35 | retire de la base de connaissances les événements passés |
| `relancer-annonces-expirant` | chaque jour à 8 h 40 | relance les auteurs d’annonces qui expirent sous 3 jours ou viennent d’expirer |

## Sauvegardes

Plan gratuit Supabase : sauvegardes quotidiennes limitées. Avant la production : plan avec restauration ponctuelle (PITR) ou `pg_dump` planifié, et restauration testée.
