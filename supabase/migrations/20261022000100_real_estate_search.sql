-- =============================================================================
-- Niveau 9 : recherche immobilière (filtres sur les attributs déclarés).
-- SECURITY INVOKER : règles d'accès et droits par colonne appliqués ; seules
-- les annonces publiées et actives sont renvoyées.
-- =============================================================================

-- Lecture sûre d'un attribut numérique ou booléen (valeur mal typée → null).
create or replace function public.attr_int(p_attributes jsonb, p_key text)
returns integer language sql immutable parallel safe set search_path = '' as $$
  select case when jsonb_typeof(p_attributes -> p_key) = 'number' then floor((p_attributes ->> p_key)::numeric)::integer end
$$;

create or replace function public.attr_bool(p_attributes jsonb, p_key text)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select case when jsonb_typeof(p_attributes -> p_key) = 'boolean' then (p_attributes ->> p_key)::boolean end
$$;

create or replace function public.search_real_estate(
  p_city uuid,
  p_categories uuid[],
  p_stay text default null,
  p_query text default null,
  p_type_bien text default null,
  p_pieces_min integer default null,
  p_chambres_min integer default null,
  p_surface_min integer default null,
  p_meuble boolean default null,
  p_prix_min numeric default null,
  p_prix_max numeric default null,
  p_dispo boolean default false,
  p_confirmed_days integer default null,
  p_neighborhood uuid default null,
  p_equipements text[] default null,
  p_sort text default 'recent',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (id uuid, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with matches as (
    select l.id, l.price, l.published_at, public.attr_int(l.attributes, 'surface_m2') as surface
    from public.listings l
    where l.city_id = p_city
      and l.status = 'published'
      and (l.expires_at is null or l.expires_at > now())
      and l.category_id = any (p_categories)
      -- Séjour court : facturé à la nuit ou à la journée ; location classique : le reste.
      and (p_stay is null
        or (p_stay = 'short' and l.price_unit in ('par_nuit', 'par_jour'))
        or (p_stay = 'long' and (l.price_unit is null or l.price_unit not in ('par_nuit', 'par_jour'))))
      and (public.search_normalize(p_query) = ''
        or l.search_vector @@ public.search_tsquery(p_query)
        or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(l.title))
      and (p_type_bien is null or l.attributes ->> 'type_bien' = p_type_bien)
      and (p_pieces_min is null or public.attr_int(l.attributes, 'pieces') >= p_pieces_min)
      and (p_chambres_min is null or public.attr_int(l.attributes, 'chambres') >= p_chambres_min)
      and (p_surface_min is null or public.attr_int(l.attributes, 'surface_m2') >= p_surface_min)
      and (p_meuble is null or public.attr_bool(l.attributes, 'meuble') = p_meuble)
      and (p_prix_min is null or l.price >= p_prix_min)
      and (p_prix_max is null or l.price <= p_prix_max)
      and (not p_dispo or l.availability_status = 'available')
      and (p_confirmed_days is null or coalesce(l.last_confirmed_at, l.published_at) >= now() - make_interval(days => p_confirmed_days))
      and (p_neighborhood is null or l.neighborhood_id = p_neighborhood)
      and (p_equipements is null or cardinality(p_equipements) = 0
        or (jsonb_typeof(l.attributes -> 'equipements') = 'array' and (l.attributes -> 'equipements') ?& p_equipements))
  )
  select m.id, count(*) over ()
  from matches m
  order by
    case when p_sort = 'prix_asc' then m.price end asc nulls last,
    case when p_sort = 'prix_desc' then m.price end desc nulls last,
    case when p_sort = 'surface_desc' then m.surface end desc nulls last,
    m.published_at desc nulls last,
    m.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke execute on function public.search_real_estate(uuid, uuid[], text, text, text, integer, integer, integer, boolean, numeric, numeric, boolean, integer, uuid, text[], text, integer, integer) from public;
grant execute on function public.search_real_estate(uuid, uuid[], text, text, text, integer, integer, integer, boolean, numeric, numeric, boolean, integer, uuid, text[], text, integer, integer) to anon, authenticated;
