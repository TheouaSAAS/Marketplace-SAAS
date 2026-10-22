-- =============================================================================
-- Niveau 12 : tourisme et itinéraires.
-- - Lieux touristiques, activités, hébergements, restaurants et opérateurs =
--   lieux (`places`) des catégories « Découvrir » ; aucune donnée inventée.
-- - Attributs déclarés en listes fermées (thèmes, public, durée, accessibilité),
--   conditions d'accès et avertissements en texte : absents → « information à
--   confirmer localement » à l'affichage.
-- - Recherche et candidats d'itinéraire : seulement des lieux publiés et
--   visibles, avec leur statut de vérification.
-- =============================================================================

-- Opérateurs touristiques (excursions, guides) : nouvelle catégorie administrable.
insert into public.categories (family, slug, name, content_types, sort_order, keywords)
values ('decouvrir', 'excursions-guides', 'Excursions, guides et opérateurs', '{place,business}', 60,
        '{excursion,guide,visite guidee,circuit,pirogue,randonnee,operateur,agence de voyage}')
on conflict (slug) do nothing;

update public.categories c set keywords = v.keywords::text[]
from (values
  ('lieux-a-visiter', '{monument,musee,patrimoine,village,marche,port,eglise,mosquee,point de vue,a voir}'),
  ('plages-sites-naturels', '{plage,baignade,mer,lagune,riviere,cascade,foret,parc,nature,mangrove}'),
  ('hotels-hebergements', '{hotel,auberge,residence,chambre,dormir,hebergement,maison d hotes,campement}'),
  ('loisirs-activites', '{loisir,activite,bar,boite,concert,sport,piscine,jeux,sortie,detente}')
) as v(slug, keywords)
where c.slug = v.slug and c.keywords = '{}';

alter table public.places
  add column themes text[] not null default '{}' check (themes <@ array[
    'nature', 'plage', 'culture', 'histoire', 'gastronomie', 'sport', 'detente', 'artisanat', 'vie_nocturne']::text[]),
  add column audiences text[] not null default '{}' check (audiences <@ array[
    'familles', 'enfants', 'couples', 'groupes', 'seniors']::text[]),
  add column visit_duration text check (visit_duration in ('moins_1h', 'une_2h', 'demi_journee', 'journee')),
  add column accessibility text[] not null default '{}' check (accessibility <@ array[
    'fauteuil_roulant', 'poussette', 'stationnement_proche', 'acces_voiture']::text[]),
  add column access_conditions text check (access_conditions is null or char_length(access_conditions) <= 1000),
  add column warnings text check (warnings is null or char_length(warnings) <= 1000);

-- Rang d'une durée de visite (filtre « durée maximale »).
create or replace function public.visit_duration_rank(p_duration text)
returns integer language sql immutable set search_path = '' as $$
  select array_position(array['moins_1h', 'une_2h', 'demi_journee', 'journee'], p_duration)
$$;

-- -----------------------------------------------------------------------------
-- Recherche touristique (droits de l'appelant). Ordre public : vérification à
-- jour, puis thèmes demandés couverts, puis mise à jour récente ; ou distance.
-- -----------------------------------------------------------------------------
create or replace function public.search_tourism(
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
  p_offset integer default 0
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
revoke execute on function public.search_tourism(uuid, uuid[], text, text[], text[], text, smallint, text[], boolean, double precision, double precision, integer, text, integer, integer) from public;
grant execute on function public.search_tourism(uuid, uuid[], text, text[], text[], text, smallint, text[], boolean, double precision, double precision, integer, text, integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Candidats d'itinéraire : tout ce qu'il faut pour composer une journée sans
-- rien inventer (position seulement si elle est connue).
-- -----------------------------------------------------------------------------
create or replace function public.itinerary_candidates(p_city uuid, p_categories uuid[])
returns table (
  id uuid, slug text, name text, category_slug text, verification_status public.verification_status, verified_at timestamptz,
  themes text[], audiences text[], visit_duration text, price_level smallint, accessibility text[], warnings text,
  lat double precision, lng double precision
)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.slug, p.name, c.slug, p.verification_status, p.verified_at,
         p.themes, p.audiences, p.visit_duration, p.price_level, p.accessibility, p.warnings,
         extensions.st_y(p.location::extensions.geometry), extensions.st_x(p.location::extensions.geometry)
  from public.places p
  join public.categories c on c.id = p.category_id
  where p.city_id = p_city
    and p.status = 'published'
    and public.verification_publicly_visible(p.verification_status)
    and p.category_id = any (p_categories)
  order by p.updated_at desc
  limit 300
$$;
revoke execute on function public.itinerary_candidates(uuid, uuid[]) from public;
grant execute on function public.itinerary_candidates(uuid, uuid[]) to anon, authenticated;
