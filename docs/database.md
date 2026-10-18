# Base de données

PostgreSQL 17 (Supabase) avec PostGIS, `unaccent`, `pg_trgm`, `vector`. Schéma : `supabase/migrations/`. Référentiel : `supabase/seed.sql`. Types TypeScript générés : `src/types/database.ts`.

**État (2026-10-18)** : 9 migrations **appliquées** sur le projet `towkxqwdvjdajlohevxt` (eu-west-1) ; référentiel et données de démonstration chargés ; **80 vérifications de sécurité réussies sur la base réelle** (`npm run db:verify`).

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

## Tables (39, toutes avec RLS)

| Domaine | Tables |
| --- | --- |
| Référentiel | `cities`, `neighborhoods` (noms alternatifs, périmètre facultatif), `categories`, `guide_sections`, `plans`, `platform_settings` |
| Comptes | `profiles`, `user_preferences`, `consents` (historique, ajout seul), `user_devices`, `newcomer_plans`, `saved_searches` |
| Organisations | `organizations`, `organization_members`, `business_profiles` (vitrines) |
| Contenus | `listings`, `places` (établissements et lieux touristiques), `events` (report, annulation), `guide_articles` + `guide_article_versions`, `images` |
| Gouvernance | `sources`, `content_revisions` (avant/après, auteur, raison), `admin_audit_log` |
| Interactions | `favorites`, `contact_requests`, `conversations`, `conversation_participants`, `messages`, `reviews`, `job_applications`, `reports`, `guide_suggestions`, `notifications` |
| Monétisation | `subscriptions`, `payments`, `sponsored_campaigns` |
| IA | `knowledge_documents`, `knowledge_chunks` (embeddings) |

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

## Règles en base (déclencheurs)

`enforce_content_rules` (modération + vérification), `validate_content_references` (catégorie, quartier, ville), `validate_organization_assignment` (publier au nom d'une organisation), `protect_profile_privileges` (rôles), `protect_organization_members` (toujours un propriétaire), `enforce_review_rules` (pas d'auto-évaluation ; le professionnel répond sans modifier la note), `validate_job_application` (offre d'emploi publiée et ouverte), `track_event_schedule` (report, annulation motivée), `record_revision` (historique), versionnement du guide, `set_contact_request_recipient`.

Dans une fonction `SECURITY DEFINER`, tester le contexte système avec `is_service_request()`, jamais `is_service_context()` (voir décision D20).

## Données

- `supabase/seed.sql` : San Pedro, 42 catégories, 3 offres, paramètres. `supabase/seeds/quartiers_san_pedro.sql` : 10 quartiers **à valider**.
- `supabase/seeds/demo.sql` : 5 lieux, 4 annonces, 1 événement, 1 article, **tous fictifs** (`placeholder`, titres « Exemple — … », sans téléphone, prix, horaire ni adresse). Suppression : `supabase/seeds/demo_remove.sql`.

## Tâches planifiées (à activer)

```sql
select cron.schedule('expirer-annonces', '15 * * * *', $$select public.expire_listings()$$);
```

## Sauvegardes

Plan gratuit Supabase : sauvegardes quotidiennes limitées. Avant la production : plan avec restauration ponctuelle (PITR) ou `pg_dump` planifié, et restauration testée.
