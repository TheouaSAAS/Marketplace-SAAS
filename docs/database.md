# Base de données

PostgreSQL (Supabase) avec PostGIS. Schéma : `supabase/migrations/`. Référentiel : `supabase/seed.sql`.

**État (2026-10-17)** : migrations **appliquées** sur le projet Supabase `towkxqwdvjdajlohevxt` (PostgreSQL 17.11, région eu-west-1), données de référence chargées, **34 vérifications de sécurité réussies sur la base réelle** (`npm run db:verify`).

## Outil `scripts/db.mjs`

| Commande | Effet |
| --- | --- |
| `npm run db:status` | Version, extensions, tables, migrations appliquées ou en attente (lecture seule) |
| `npm run db:migrate` | Applique les migrations en attente, chacune dans une transaction (tout ou rien), tracées dans `supabase_migrations.schema_migrations` |
| `npm run db:seed` | Rejoue `supabase/seed.sql` (idempotent) ; `node scripts/db.mjs seed <fichier>` pour un autre fichier |
| `npm run db:verify` | Exécute `supabase/tests/*.sql` : scénarios visiteur / membre / modérateur dans une transaction **annulée** (aucune trace) |

Connexion : `DATABASE_URL` (PostgreSQL direct ou pooler) ou, à défaut, `SUPABASE_ACCESS_TOKEN` (API d'administration Supabase en HTTPS). Le jeton d'accès donne accès à tout le compte Supabase : le révoquer quand il n'est plus nécessaire.

**Règle** : une migration appliquée n'est jamais modifiée ; toute correction passe par une nouvelle migration (exemple : `20261017000300_fix_audit_log_access.sql`).

## Tables

| Table | Rôle | Points clés |
| --- | --- | --- |
| `cities` | Villes | `is_default` unique, `is_active`, `launch_status`, `center`, `settings` jsonb |
| `neighborhoods` | Quartiers | rattachés à une ville, `(city_id, slug)` unique |
| `categories` | Catégories et sous-catégories | `family` (découvrir/trouver/entreprendre), `content_types` autorisés, `attribute_schema` |
| `profiles` | Profil d'un compte `auth.users` | créé par déclencheur ; `role` ; `is_suspended` |
| `business_profiles` | Fiches entreprise / pages pro | statut de modération, `is_verified` |
| `places` | Établissements et lieux touristiques | `kind`, `location`, `verified_at` |
| `listings` | Annonces | prix en XOF, `attributes` jsonb par catégorie, `expires_at`, contacts propres à l'annonce |
| `events` | Événements | `starts_at`/`ends_at`, gratuit ou fourchette de prix |
| `images` | Images d'un contenu | exactement un parent ; fichier dans le bucket `media` |
| `favorites` | Favoris | un par contenu et par utilisateur |
| `contact_requests` | Demandes de contact / devis | destinataire déduit par déclencheur |
| `reports` | Signalements | traités par la modération |
| `notifications` | Notifications | créées par le serveur |
| `plans` | Offres (gratuit, pro, premium) | prix et limites modifiables ; pro/premium inactifs tant que non tarifés |
| `subscriptions` | Abonnements | `active` uniquement après paiement confirmé |
| `payments` | Paiements | `provider_reference` unique (idempotence des webhooks) ; charge brute non lisible par les utilisateurs |
| `sponsored_campaigns` | Mises en avant payantes | emplacement, ville, période |
| `platform_settings` | Paramètres sans code | durée de diffusion, rayons de recherche… |
| `admin_audit_log` | Journal d'administration | ajout seul via `log_admin_action()` |

Tous les contenus ont un `slug` unique (URL lisibles), `created_at`/`updated_at`, un `status` (`draft`, `pending`, `published`, `rejected`, `expired`, `archived`) et un `search_vector` plein texte français sans accents.

## Coordonnées

- `geography(Point, 4326)` : **longitude puis latitude** (`ST_MakePoint(lng, lat)`).
- `location_precision` : `exact`, `approximate` ou `unknown` ; une contrainte impose `unknown` ⇔ pas de coordonnées. Un contenu sans coordonnées n'est jamais présenté comme « proche ».
- Aucune table ne stocke la position des visiteurs (vérifié par test).

## Index

GiST sur chaque `location` (proximité), GIN sur chaque `search_vector` (texte), trigrammes sur les noms (fautes de frappe), index composites ville/statut/date et clés étrangères usuelles.

## Sécurité (migration `…_security.sql`)

- **RLS active sur toutes les tables.** Public : contenus publiés (et annonces non expirées). Propriétaire : ses contenus quel que soit le statut. Modération (`moderator`, `admin`) : tout.
- **`enforce_content_rules`** (déclencheur) : un utilisateur ne peut créer qu'en brouillon/attente, ne peut pas se publier, ne peut pas modifier les champs de modération (vérification, dates, motif, vues, propriétaire) ; modifier une publication la renvoie en vérification ; un rejet exige un motif ; la publication fixe `published_at` et l'échéance (`listings.default_duration`, 60 jours par défaut).
- **`validate_content_references`** : catégorie active et adaptée, quartier de la bonne ville, ville ouverte.
- **`protect_profile_privileges`** : rôle et suspension modifiables par un administrateur seulement.
- Paiements et abonnements : aucune écriture possible avec la clé publique.
- Stockage `media` : public en lecture, écriture limitée au dossier `<uid>/`, JPEG/PNG/WebP, 5 Mo maximum.

## Tâches planifiées (à activer après connexion)

Expiration des annonces, avec l'extension `pg_cron` :

```sql
select cron.schedule('expirer-annonces', '15 * * * *', $$select public.expire_listings()$$);
```

## Types TypeScript

Après connexion du projet : `npx supabase gen types typescript --project-id <id> > src/types/database.ts`, puis typer les clients. En attendant, les dépôts valident chaque réponse avec Zod.

## Sauvegardes

Plan gratuit Supabase : sauvegardes quotidiennes limitées. Avant la mise en production, prévoir un plan avec sauvegardes à restauration ponctuelle (PITR) ou un export `pg_dump` planifié, et tester une restauration (§3.14).
