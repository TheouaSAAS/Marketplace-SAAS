-- =============================================================================
-- Carrefour des Possibles — Schéma initial
-- Migration 0001 : extensions, types, tables, index, déclencheurs.
-- Les règles d'accès (RLS) sont dans la migration suivante.
--
-- Conventions :
--   * identifiants uuid (gen_random_uuid), dates timestamptz en UTC ;
--   * created_at / updated_at sur toutes les tables modifiables ;
--   * coordonnées en geography(Point, 4326) : longitude puis latitude ;
--     elles ne concernent QUE des lieux et contenus publiés, jamais la
--     position personnelle des visiteurs (non stockée, cf. §3.9.I) ;
--   * montants en FCFA (XOF), entiers ou numeric(14,2).
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() n'est pas IMMUTABLE : enveloppe immuable pour les colonnes générées et index.
create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'professional', 'moderator', 'admin');
create type public.content_status as enum ('draft', 'pending', 'published', 'rejected', 'expired', 'archived');
create type public.category_family as enum ('decouvrir', 'trouver', 'entreprendre');
create type public.content_type as enum ('listing', 'place', 'event', 'business');
create type public.place_kind as enum ('etablissement', 'lieu_touristique');
create type public.location_precision as enum ('exact', 'approximate', 'unknown');
create type public.price_unit as enum ('total', 'par_mois', 'par_jour', 'par_nuit', 'par_heure', 'a_partir_de');
create type public.city_launch_status as enum ('planned', 'pilot', 'open');
create type public.contact_request_kind as enum ('contact', 'devis');
create type public.contact_request_status as enum ('new', 'read', 'replied', 'archived');
create type public.report_reason as enum ('arnaque', 'contenu_inapproprie', 'doublon', 'informations_erronees', 'autre');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');
create type public.billing_period as enum ('month', 'year', 'one_time');
create type public.subscription_status as enum ('pending', 'active', 'past_due', 'canceled', 'expired');
create type public.payment_provider as enum ('orange_money', 'mtn_momo', 'wave', 'card', 'manual');
create type public.payment_status as enum ('initiated', 'pending', 'succeeded', 'failed', 'canceled', 'refunded');
create type public.campaign_placement as enum ('home', 'search', 'category', 'map');
create type public.campaign_status as enum ('draft', 'pending_payment', 'active', 'paused', 'ended', 'rejected');

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Référentiel : villes, quartiers, catégories
-- -----------------------------------------------------------------------------
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  region text,
  country_code char(2) not null default 'CI',
  center extensions.geography(point, 4326),
  default_zoom smallint not null default 13 check (default_zoom between 3 and 19),
  launch_status public.city_launch_status not null default 'planned',
  is_active boolean not null default false,
  is_default boolean not null default false,
  -- Paramètres propres à la ville (rayons proposés, durée de diffusion, etc.).
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Une seule ville par défaut.
create unique index cities_single_default_idx on public.cities (is_default) where is_default;

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  center extensions.geography(point, 4326),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  family public.category_family not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  -- Nom d'icône lucide (ex. « utensils »), interprété par l'interface.
  icon text,
  -- Types de contenus rattachables à cette catégorie.
  content_types public.content_type[] not null default '{}',
  -- Schéma d'attributs spécifiques (immobilier, emploi, vehicule…), validé côté serveur.
  attribute_schema text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categories_parent_idx on public.categories (parent_id);
create index categories_family_idx on public.categories (family, sort_order);

-- -----------------------------------------------------------------------------
-- Comptes
-- -----------------------------------------------------------------------------
-- Profil applicatif d'un compte auth.users. Créé automatiquement à l'inscription.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  avatar_url text,
  role public.user_role not null default 'user',
  default_city_id uuid references public.cities (id) on delete set null,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fiche entreprise / page professionnelle (annuaire).
create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 5000),
  category_id uuid references public.categories (id) on delete set null,
  city_id uuid not null references public.cities (id) on delete restrict,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  address_text text,
  location extensions.geography(point, 4326),
  location_precision public.location_precision not null default 'unknown',
  phone text,
  whatsapp text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text,
  logo_path text,
  cover_path text,
  opening_hours jsonb,
  is_verified boolean not null default false,
  status public.content_status not null default 'draft',
  rejection_reason text,
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(description, ''))), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((location is null) = (location_precision = 'unknown'))
);

-- -----------------------------------------------------------------------------
-- Contenus
-- -----------------------------------------------------------------------------
-- Lieux : établissements (commerces, restaurants, hôtels, services) et lieux touristiques.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  kind public.place_kind not null,
  business_id uuid references public.business_profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  summary text check (summary is null or char_length(summary) <= 280),
  description text check (description is null or char_length(description) <= 10000),
  category_id uuid not null references public.categories (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  address_text text,
  location extensions.geography(point, 4326),
  location_precision public.location_precision not null default 'unknown',
  phone text,
  whatsapp text,
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website text,
  opening_hours jsonb,
  -- Niveau de prix indicatif 1 à 4, uniquement s'il est connu.
  price_level smallint check (price_level between 1 and 4),
  is_verified boolean not null default false,
  -- Date de la dernière vérification des informations (fiabilité, §1 objectif 4).
  verified_at timestamptz,
  status public.content_status not null default 'draft',
  rejection_reason text,
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(summary, ''))), 'B') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(description, ''))), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((location is null) = (location_precision = 'unknown'))
);

-- Annonces : immobilier, emploi, biens, véhicules, services, opportunités…
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 10000),
  category_id uuid not null references public.categories (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  price numeric(14, 2) check (price is null or price >= 0),
  price_unit public.price_unit,
  currency char(3) not null default 'XOF',
  is_negotiable boolean not null default false,
  -- Attributs propres à la catégorie (surface, pièces, type de contrat…), validés côté serveur.
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  address_text text,
  location extensions.geography(point, 4326),
  location_precision public.location_precision not null default 'unknown',
  -- Coordonnées de contact choisies par l'annonceur pour CETTE annonce.
  contact_name text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.content_status not null default 'draft',
  rejection_reason text,
  published_at timestamptz,
  expires_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(description, ''))), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((location is null) = (location_precision = 'unknown')),
  check (price_unit is null or price is not null),
  check (expires_at is null or published_at is null or expires_at > published_at)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 10000),
  category_id uuid not null references public.categories (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  address_text text,
  location extensions.geography(point, 4326),
  location_precision public.location_precision not null default 'unknown',
  is_free boolean not null default false,
  price_min integer check (price_min is null or price_min >= 0),
  price_max integer check (price_max is null or price_max >= 0),
  ticket_url text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.content_status not null default 'draft',
  rejection_reason text,
  published_at timestamptz,
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(description, ''))), 'B')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((location is null) = (location_precision = 'unknown')),
  check (ends_at is null or ends_at >= starts_at),
  check (price_max is null or price_min is null or price_max >= price_min),
  check (not is_free or (price_min is null and price_max is null))
);

-- Images rattachées à exactement un contenu. Les fichiers sont dans le bucket Storage `media`.
create table public.images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete cascade,
  storage_path text not null unique,
  alt_text text check (alt_text is null or char_length(alt_text) <= 200),
  width integer check (width > 0),
  height integer check (height > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) = 1)
);

-- -----------------------------------------------------------------------------
-- Interactions
-- -----------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) = 1)
);
create unique index favorites_listing_uidx on public.favorites (user_id, listing_id) where listing_id is not null;
create unique index favorites_place_uidx on public.favorites (user_id, place_id) where place_id is not null;
create unique index favorites_event_uidx on public.favorites (user_id, event_id) where event_id is not null;
create unique index favorites_business_uidx on public.favorites (user_id, business_id) where business_id is not null;

-- Demande de contact ou de devis adressée au propriétaire d'un contenu.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  kind public.contact_request_kind not null default 'contact',
  sender_id uuid references public.profiles (id) on delete set null,
  -- Destinataire déduit du contenu ciblé par déclencheur (jamais fourni par le client).
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 2 and 80),
  sender_email text check (sender_email is null or sender_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  sender_phone text,
  message text not null check (char_length(message) between 10 and 3000),
  status public.contact_request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) = 1),
  check (sender_email is not null or sender_phone is not null)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 2000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) = 1)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Monétisation (prix et limites modifiables depuis l'administration, §3.11)
-- -----------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  price_xof integer not null default 0 check (price_xof >= 0),
  billing_period public.billing_period not null default 'month',
  -- Ex. {"max_active_listings": 3, "max_images_per_listing": 5, "stats": "basic"}
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete set null,
  plan_id uuid not null references public.plans (id) on delete restrict,
  -- « active » n'est posé que par le serveur après confirmation du paiement (§3.12).
  status public.subscription_status not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_start is null or current_period_end > current_period_start)
);

create table public.sponsored_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  placement public.campaign_placement not null,
  city_id uuid not null references public.cities (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  budget_xof integer not null check (budget_xof >= 0),
  status public.campaign_status not null default 'draft',
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) = 1)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  campaign_id uuid references public.sponsored_campaigns (id) on delete set null,
  amount_xof integer not null check (amount_xof > 0),
  currency char(3) not null default 'XOF',
  provider public.payment_provider not null,
  -- Référence de transaction du prestataire : garantit l'idempotence des webhooks.
  provider_reference text unique,
  status public.payment_status not null default 'initiated',
  -- Charge utile brute du prestataire, conservée pour audit (jamais exposée au client).
  provider_payload jsonb,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(subscription_id, campaign_id) = 1),
  check (status <> 'succeeded' or confirmed_at is not null)
);

-- -----------------------------------------------------------------------------
-- Administration
-- -----------------------------------------------------------------------------
-- Paramètres globaux modifiables sans code (ex. durée de diffusion, publication gratuite).
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Journal des opérations administratives (§3.14), en ajout seul.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Index pour les recherches fréquentes
-- -----------------------------------------------------------------------------
-- Proximité (PostGIS) : uniquement les lignes géolocalisées.
create index listings_location_gix on public.listings using gist (location) where location is not null;
create index places_location_gix on public.places using gist (location) where location is not null;
create index events_location_gix on public.events using gist (location) where location is not null;
create index business_profiles_location_gix on public.business_profiles using gist (location) where location is not null;

-- Texte intégral.
create index listings_search_gin on public.listings using gin (search_vector);
create index places_search_gin on public.places using gin (search_vector);
create index events_search_gin on public.events using gin (search_vector);
create index business_profiles_search_gin on public.business_profiles using gin (search_vector);

-- Listes publiques par ville, catégorie et date.
create index listings_public_idx on public.listings (city_id, status, published_at desc);
create index listings_category_idx on public.listings (category_id, status, published_at desc);
create index listings_neighborhood_idx on public.listings (neighborhood_id) where neighborhood_id is not null;
create index listings_price_idx on public.listings (city_id, price) where status = 'published';
create index listings_owner_idx on public.listings (owner_id, status);
create index listings_expiry_idx on public.listings (expires_at) where status = 'published';
create index places_public_idx on public.places (city_id, status, kind);
create index places_category_idx on public.places (category_id, status);
create index places_neighborhood_idx on public.places (neighborhood_id) where neighborhood_id is not null;
create index events_public_idx on public.events (city_id, status, starts_at);
create index events_category_idx on public.events (category_id, status, starts_at);
create index business_profiles_public_idx on public.business_profiles (city_id, status);
create index business_profiles_owner_idx on public.business_profiles (owner_id);
create index neighborhoods_city_idx on public.neighborhoods (city_id) where is_active;

-- Recherche approchée sur les noms (fautes de frappe).
create index places_name_trgm on public.places using gin (public.immutable_unaccent(name) extensions.gin_trgm_ops);
create index business_profiles_name_trgm on public.business_profiles using gin (public.immutable_unaccent(name) extensions.gin_trgm_ops);

-- Clés étrangères fréquemment jointes ou filtrées.
create index images_listing_idx on public.images (listing_id, sort_order) where listing_id is not null;
create index images_place_idx on public.images (place_id, sort_order) where place_id is not null;
create index images_event_idx on public.images (event_id, sort_order) where event_id is not null;
create index images_business_idx on public.images (business_id, sort_order) where business_id is not null;
create index favorites_user_idx on public.favorites (user_id, created_at desc);
create index contact_requests_recipient_idx on public.contact_requests (recipient_id, status, created_at desc);
create index contact_requests_sender_idx on public.contact_requests (sender_id) where sender_id is not null;
create index reports_status_idx on public.reports (status, created_at);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index sponsored_campaigns_active_idx on public.sponsored_campaigns (city_id, placement, starts_at, ends_at) where status = 'active';
create index admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Déclencheurs updated_at
-- -----------------------------------------------------------------------------
create trigger cities_updated_at before update on public.cities for each row execute function public.set_updated_at();
create trigger neighborhoods_updated_at before update on public.neighborhoods for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger business_profiles_updated_at before update on public.business_profiles for each row execute function public.set_updated_at();
create trigger places_updated_at before update on public.places for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger contact_requests_updated_at before update on public.contact_requests for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
create trigger plans_updated_at before update on public.plans for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger sponsored_campaigns_updated_at before update on public.sponsored_campaigns for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger platform_settings_updated_at before update on public.platform_settings for each row execute function public.set_updated_at();
