-- =============================================================================
-- Niveau 2 — 4/5 : confidentialité des positions et des coordonnées.
--
-- Principe : la position précise est OBLIGATOIRE à la soumission d'une annonce
-- (recherche de proximité fiable), mais le public ne lit que `location_public`,
-- dégradée selon le choix de l'annonceur. Les colonnes sensibles (position
-- exacte, adresse, téléphone, WhatsApp, e-mail) ne sont pas lisibles par les
-- rôles de l'API : la protection ne dépend pas de l'interface.
-- =============================================================================

-- Accorde la lecture de toutes les colonnes d'une table SAUF celles listées.
-- À rappeler après tout ajout de colonne à une table protégée.
create or replace function public.grant_public_columns(p_table text, p_hidden text[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table and column_name <> all (p_hidden);
  execute format('revoke select on public.%I from anon, authenticated', p_table);
  execute format('grant select (%s) on public.%I to anon, authenticated', v_columns, p_table);
end;
$$;
revoke execute on function public.grant_public_columns(text, text[]) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Annonces
-- -----------------------------------------------------------------------------
alter table public.listings
  add column public_location_precision public.public_location_precision not null default 'approximate',
  add column show_phone boolean not null default false,
  add column show_whatsapp boolean not null default false,
  add column show_email boolean not null default false,
  -- Position publiée : exacte, arrondie à ~550 m (grille de 0,005°), ou absente
  -- (quartier seulement / masquée : l'interface utilise alors le quartier).
  add column location_public extensions.geography(point, 4326) generated always as (
    case public_location_precision
      when 'exact' then location
      when 'approximate' then extensions.st_snaptogrid(location::extensions.geometry, 0.005)::extensions.geography
      else null
    end
  ) stored;

-- Position précise obligatoire dès la soumission (le brouillon peut rester incomplet).
alter table public.listings
  add constraint listings_location_required check (status = 'draft' or location is not null);

create index listings_location_public_gix on public.listings using gist (location_public) where location_public is not null;

select public.grant_public_columns('listings',
  array['location', 'address_text', 'contact_phone', 'contact_whatsapp', 'contact_email']);

-- -----------------------------------------------------------------------------
-- Fiches entreprise (artisans travaillant à domicile, par exemple)
-- -----------------------------------------------------------------------------
alter table public.business_profiles
  add column public_location_precision public.public_location_precision not null default 'exact',
  add column location_public extensions.geography(point, 4326) generated always as (
    case public_location_precision
      when 'exact' then location
      when 'approximate' then extensions.st_snaptogrid(location::extensions.geometry, 0.005)::extensions.geography
      else null
    end
  ) stored;

create index business_profiles_location_public_gix on public.business_profiles using gist (location_public) where location_public is not null;

select public.grant_public_columns('business_profiles', array['location', 'address_text']);

-- -----------------------------------------------------------------------------
-- Lecture des champs privés par l'auteur, son organisation ou l'équipe
-- -----------------------------------------------------------------------------
create or replace function public.listing_private_fields(p_listing uuid)
returns table (
  latitude double precision,
  longitude double precision,
  address_text text,
  contact_phone text,
  contact_whatsapp text,
  contact_email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extensions.st_y(l.location::extensions.geometry),
    extensions.st_x(l.location::extensions.geometry),
    l.address_text,
    l.contact_phone,
    l.contact_whatsapp,
    l.contact_email
  from public.listings l
  where l.id = p_listing
    and (public.can_manage_content(l.owner_id, l.organization_id) or public.is_staff())
$$;
revoke execute on function public.listing_private_fields(uuid) from public, anon;
grant execute on function public.listing_private_fields(uuid) to authenticated;

create or replace function public.business_private_location(p_business uuid)
returns table (latitude double precision, longitude double precision, address_text text)
language sql
stable
security definer
set search_path = ''
as $$
  select extensions.st_y(b.location::extensions.geometry), extensions.st_x(b.location::extensions.geometry), b.address_text
  from public.business_profiles b
  where b.id = p_business
    and (public.can_manage_content(b.owner_id, b.organization_id) or public.is_staff())
$$;
revoke execute on function public.business_private_location(uuid) from public, anon;
grant execute on function public.business_private_location(uuid) to authenticated;
