-- =============================================================================
-- Niveau 2 — 1/5 : rôles étendus et nouveaux types.
-- Isolée : une valeur ajoutée à un enum (ADD VALUE) n'est utilisable qu'après
-- validation de la transaction qui l'a créée.
--
-- Rôles : visiteur (pas de ligne), membre (user), professionnel, éditeur local
-- (local_editor), modérateur, administrateur, superadministrateur.
-- =============================================================================

alter type public.user_role add value if not exists 'local_editor' before 'moderator';
alter type public.user_role add value if not exists 'superadmin' after 'admin';

-- Gouvernance des données locales (docs/data-governance.md).
create type public.verification_status as enum ('verified', 'pending_validation', 'placeholder', 'archived', 'rejected');
create type public.source_kind as enum ('terrain', 'officiel', 'partenaire', 'declaratif', 'publication', 'autre');

-- Confidentialité de la position publiée.
create type public.public_location_precision as enum ('exact', 'approximate', 'neighborhood', 'hidden');

-- Organisations.
create type public.organization_kind as enum ('entreprise', 'commerce', 'artisan', 'agence', 'association', 'institution', 'operateur_touristique', 'autre');
create type public.organization_role as enum ('owner', 'admin', 'editor', 'viewer');

-- Domaines.
create type public.availability_status as enum ('available', 'reserved', 'unavailable', 'unknown');
create type public.event_schedule_status as enum ('scheduled', 'postponed', 'cancelled');
create type public.application_status as enum ('submitted', 'viewed', 'shortlisted', 'rejected', 'withdrawn');
create type public.review_status as enum ('pending', 'published', 'rejected', 'hidden');
create type public.consent_kind as enum ('terms', 'privacy', 'marketing_email', 'marketing_sms', 'geolocation', 'contact_sharing');
create type public.revision_action as enum ('insert', 'update', 'delete');

create extension if not exists vector with schema extensions;
