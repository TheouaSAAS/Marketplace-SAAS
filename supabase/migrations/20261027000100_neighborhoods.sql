-- =============================================================================
-- Niveau 14 : quartiers.
-- - Fiche : noms alternatifs, description neutre, responsable de la fiche ;
--   statut, source et date de contrôle existent depuis le niveau 2.
-- - Périmètre FACULTATIF : proposé en brouillon, validé ou refusé par l'équipe
--   locale ; chaque version reste dans l'historique et la publication ne passe
--   que par la validation (audit).
-- - Ressources d'un quartier : seulement les contenus qui lui sont rattachés.
-- =============================================================================

-- alt_names, description et boundary existent depuis le niveau 2 (20261018000500_domains.sql).
alter table public.neighborhoods
  add constraint neighborhoods_alt_names_max check (cardinality(alt_names) <= 10),
  -- Personne de l'équipe locale responsable de la fiche (contrôle, corrections).
  add column steward_id uuid references public.profiles (id) on delete set null,
  -- Le périmètre publié est la copie du dernier brouillon validé (jamais saisi directement).
  add column boundary_validated_at timestamptz;

-- -----------------------------------------------------------------------------
-- Périmètres : brouillons, validation, historique
-- -----------------------------------------------------------------------------
create table public.neighborhood_boundaries (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid not null references public.neighborhoods (id) on delete cascade,
  geometry extensions.geography(multipolygon, 4326) not null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'rejected', 'superseded')),
  source_id uuid references public.sources (id) on delete restrict,
  note text check (note is null or char_length(note) <= 1000),
  proposed_by uuid references public.profiles (id) on delete set null,
  proposed_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 1000)
);
create index neighborhood_boundaries_idx on public.neighborhood_boundaries (neighborhood_id, proposed_at desc);
alter table public.neighborhood_boundaries enable row level security;
create policy neighborhood_boundaries_curator on public.neighborhood_boundaries for select to authenticated
  using ((select public.is_curator()) or (select public.is_staff()));
-- Écriture uniquement par les fonctions ci-dessous (traçabilité).
revoke insert, update, delete on public.neighborhood_boundaries from anon, authenticated;

-- Le périmètre publié ne change que par validation d'un brouillon.
create or replace function public.protect_neighborhood_boundary()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_service_context() or public.is_service_request() then
    return new;
  end if;
  if new.boundary is distinct from old.boundary or new.boundary_validated_at is distinct from old.boundary_validated_at then
    raise exception 'Un périmètre se modifie par un brouillon validé, jamais directement.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger neighborhoods_protect_boundary before update on public.neighborhoods
  for each row execute function public.protect_neighborhood_boundary();

-- Brouillon à partir d'un GeoJSON (Polygon ou MultiPolygon), contrôlé : géométrie valide,
-- 50 km² au plus, à moins de 40 km de la ville.
create or replace function public.propose_neighborhood_boundary(p_neighborhood uuid, p_geojson text, p_source uuid default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_geometry extensions.geometry;
  v_id uuid;
  v_city_center extensions.geography;
begin
  if not public.is_curator() then
    raise exception 'Réservé à l''équipe locale.' using errcode = '42501';
  end if;
  begin
    v_geometry := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson), 4326);
  exception when others then
    raise exception 'GeoJSON illisible : collez un objet de type Polygon ou MultiPolygon.' using errcode = '23514';
  end;
  if extensions.geometrytype(v_geometry) not in ('POLYGON', 'MULTIPOLYGON') then
    raise exception 'Le périmètre doit être un polygone (Polygon ou MultiPolygon).' using errcode = '23514';
  end if;
  if not extensions.st_isvalid(v_geometry) then
    raise exception 'Polygone invalide (contour croisé ou non fermé).' using errcode = '23514';
  end if;
  if extensions.st_area(v_geometry::extensions.geography) > 50000000 then
    raise exception 'Périmètre trop grand (plus de 50 km²) pour un quartier.' using errcode = '23514';
  end if;
  select c.center into v_city_center from public.neighborhoods n join public.cities c on c.id = n.city_id where n.id = p_neighborhood;
  if not found then
    raise exception 'Quartier introuvable.' using errcode = '23514';
  end if;
  if v_city_center is not null and not extensions.st_dwithin(v_geometry::extensions.geography, v_city_center, 40000) then
    raise exception 'Périmètre trop éloigné de la ville.' using errcode = '23514';
  end if;
  insert into public.neighborhood_boundaries (neighborhood_id, geometry, source_id, note, proposed_by)
  values (p_neighborhood, extensions.st_multi(v_geometry)::extensions.geography, p_source, nullif(btrim(coalesce(p_note, '')), ''), (select auth.uid()))
  returning id into v_id;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'neighborhood_boundary.propose', 'neighborhood', p_neighborhood, jsonb_build_object('boundary', v_id));
  return v_id;
end;
$$;

-- Validation (publie le périmètre, l'ancien passe « remplacé ») ou refus motivé.
create or replace function public.review_neighborhood_boundary(p_boundary uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_boundary public.neighborhood_boundaries;
begin
  if not public.is_curator() then
    raise exception 'Réservé à l''équipe locale.' using errcode = '42501';
  end if;
  select * into v_boundary from public.neighborhood_boundaries where id = p_boundary for update;
  if v_boundary.id is null or v_boundary.status <> 'draft' then
    raise exception 'Brouillon introuvable ou déjà traité.' using errcode = '23514';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Motivez le refus (5 caractères au moins).' using errcode = '23514';
  end if;
  if p_approve then
    update public.neighborhood_boundaries set status = 'superseded'
    where neighborhood_id = v_boundary.neighborhood_id and status = 'validated';
    -- Contexte du propriétaire de la fonction : autorisé par protect_neighborhood_boundary ;
    -- la modification est historisée par record_revision (avant / après).
    perform set_config('app.change_reason', 'Périmètre validé : ' || coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'sans note'), true);
    update public.neighborhoods set boundary = v_boundary.geometry, boundary_validated_at = now()
    where id = v_boundary.neighborhood_id;
  end if;
  update public.neighborhood_boundaries
  set status = case when p_approve then 'validated' else 'rejected' end,
      reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_boundary;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'neighborhood_boundary.validate' else 'neighborhood_boundary.reject' end,
          'neighborhood', v_boundary.neighborhood_id, jsonb_build_object('boundary', p_boundary));
end;
$$;

-- Retrait du périmètre publié (le quartier existe sans carte) : tracé lui aussi.
create or replace function public.clear_neighborhood_boundary(p_neighborhood uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_curator() then
    raise exception 'Réservé à l''équipe locale.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Motivez le retrait (5 caractères au moins).' using errcode = '23514';
  end if;
  update public.neighborhood_boundaries set status = 'superseded' where neighborhood_id = p_neighborhood and status = 'validated';
  perform set_config('app.change_reason', 'Périmètre retiré : ' || btrim(p_note), true);
  update public.neighborhoods set boundary = null, boundary_validated_at = null where id = p_neighborhood;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'neighborhood_boundary.clear', 'neighborhood', p_neighborhood, jsonb_build_object('note', btrim(p_note)));
end;
$$;

revoke execute on function public.propose_neighborhood_boundary(uuid, text, uuid, text) from public, anon;
revoke execute on function public.review_neighborhood_boundary(uuid, boolean, text) from public, anon;
revoke execute on function public.clear_neighborhood_boundary(uuid, text) from public, anon;
grant execute on function public.propose_neighborhood_boundary(uuid, text, uuid, text) to authenticated;
grant execute on function public.review_neighborhood_boundary(uuid, boolean, text) to authenticated;
grant execute on function public.clear_neighborhood_boundary(uuid, text) to authenticated;

-- Périmètre publié en GeoJSON (carte), seulement pour un quartier visible.
create or replace function public.neighborhood_boundary_geojson(p_neighborhood uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select extensions.st_asgeojson(n.boundary::extensions.geometry, 6)
  from public.neighborhoods n
  where n.id = p_neighborhood and n.boundary is not null
$$;
revoke execute on function public.neighborhood_boundary_geojson(uuid) from public;
grant execute on function public.neighborhood_boundary_geojson(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ressources d'un quartier : contenus publiés RATTACHÉS au quartier (relation
-- réelle neighborhood_id), comptés par famille. Droits de l'appelant.
-- -----------------------------------------------------------------------------
create or replace function public.neighborhood_resource_counts(p_neighborhood uuid)
returns table (kind text, total bigint)
language sql stable security invoker set search_path = '' as $$
  with recursive tree as (
    select c.slug as root, c.id from public.categories c
    where c.slug in ('immobilier', 'services-professionnels', 'transport-livraison', 'commerces-boutiques', 'restaurants-gastronomie',
                     'lieux-a-visiter', 'plages-sites-naturels', 'loisirs-activites', 'hotels-hebergements', 'excursions-guides')
    union all
    select t.root, c.id from public.categories c join tree t on c.parent_id = t.id
  ),
  families as (
    select id, case
      when root = 'immobilier' then 'logement'
      when root in ('services-professionnels', 'transport-livraison') then 'services'
      when root in ('commerces-boutiques', 'restaurants-gastronomie') then 'commerces'
      when root in ('hotels-hebergements', 'excursions-guides') then 'tourisme'
      else 'decouvrir' end as kind
    from tree
  )
  select f.kind, count(*) from (
    select l.category_id from public.listings l where l.neighborhood_id = p_neighborhood and l.status = 'published'
    union all
    select b.category_id from public.business_profiles b where b.neighborhood_id = p_neighborhood and b.status = 'published'
    union all
    select p.category_id from public.places p where p.neighborhood_id = p_neighborhood and p.status = 'published'
  ) content
  join families f on f.id = content.category_id
  group by f.kind
  union all
  select 'evenements', count(*) from public.events e
  where e.neighborhood_id = p_neighborhood and e.status = 'published' and coalesce(e.ends_at, e.starts_at) >= now()
$$;
revoke execute on function public.neighborhood_resource_counts(uuid) from public;
grant execute on function public.neighborhood_resource_counts(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Filtre quartier dans la recherche touristique (les autres domaines l'ont déjà)
-- -----------------------------------------------------------------------------
drop function public.search_tourism(uuid, uuid[], text, text[], text[], text, smallint, text[], boolean, double precision, double precision, integer, text, integer, integer);
create function public.search_tourism(
  p_city uuid,
  p_categories uuid[],
  p_query text default null,
  p_themes text[] default null,
  p_audiences text[] default null,
  p_max_duration text default null,
  p_budget_max smallint default null,
  p_accessibility text[] default null,
  p_verified_only boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null,
  p_sort text default 'pertinence',
  p_limit integer default 12,
  p_offset integer default 0,
  p_neighborhood uuid default null
)
returns table (id uuid, distance_m double precision, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with point as (
    select case when p_lat between -90 and 90 and p_lng between -180 and 180
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end as geo
  ),
  matches as (
    select p.id,
      case when pt.geo is not null and p.location is not null then extensions.st_distance(p.location, pt.geo) end as distance_m,
      (p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days') as verified,
      cardinality(array(select unnest(p.themes) intersect select unnest(coalesce(p_themes, '{}')))) as theme_hits,
      p.updated_at
    from public.places p, point pt
    where p.city_id = p_city
      and p.status = 'published'
      and public.verification_publicly_visible(p.verification_status)
      and p.category_id = any (p_categories)
      and (p_neighborhood is null or p.neighborhood_id = p_neighborhood)
      and (public.search_normalize(p_query) = ''
        or p.search_vector @@ public.search_tsquery(p_query)
        or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(p.name))
      and (p_themes is null or cardinality(p_themes) = 0 or p.themes && p_themes)
      and (p_audiences is null or cardinality(p_audiences) = 0 or p.audiences && p_audiences)
      and (p_max_duration is null or public.visit_duration_rank(p.visit_duration) <= public.visit_duration_rank(p_max_duration))
      and (p_budget_max is null or p.price_level <= p_budget_max)
      and (p_accessibility is null or p.accessibility @> p_accessibility)
      and (not p_verified_only or (p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days'))
      and (p_radius_m is null or pt.geo is null
        or (p.location is not null and extensions.st_dwithin(p.location, pt.geo, least(greatest(p_radius_m, 100), 200000))))
  )
  select m.id, m.distance_m, count(*) over ()
  from matches m
  order by
    case when p_sort = 'proximite' then m.distance_m end asc nulls last,
    m.verified desc,
    m.theme_hits desc,
    m.updated_at desc,
    m.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.search_tourism(uuid, uuid[], text, text[], text[], text, smallint, text[], boolean, double precision, double precision, integer, text, integer, integer, uuid) from public;
grant execute on function public.search_tourism(uuid, uuid[], text, text[], text[], text, smallint, text[], boolean, double precision, double precision, integer, text, integer, integer, uuid) to anon, authenticated;
