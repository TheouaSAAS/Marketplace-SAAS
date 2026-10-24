-- =============================================================================
-- Correctif de search_listings : une borne (année min., kilométrage max.…)
-- exclut les annonces qui n'indiquent pas la caractéristique. Avant, la
-- comparaison avec une valeur absente donnait NULL et laissait passer l'annonce.
-- =============================================================================
create or replace function public.search_listings(
  p_city uuid default null,
  p_query text default null,
  p_categories uuid[] default null,
  p_neighborhood uuid default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_available_only boolean default false,
  p_eq jsonb default null,
  p_text jsonb default null,
  p_min jsonb default null,
  p_max jsonb default null,
  p_sort text default 'recent',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (id uuid, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tsq tsquery := public.search_tsquery(p_query);
  v_norm text := public.search_normalize(p_query);
  v_has_query boolean := coalesce(v_norm, '') <> '';
begin
  return query
  select l.id, count(*) over ()
  from public.listings l
  where l.status = 'published'
    and (l.expires_at is null or l.expires_at > now())
    and public.verification_publicly_visible(l.verification_status)
    and coalesce(public.listing_schema(l.category_id), '') not in ('emploi', 'opportunite', 'appel_offres')
    and (p_city is null or l.city_id = p_city)
    and (not v_has_query or (v_tsq is not null and l.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(l.title))
    and (p_categories is null or l.category_id = any (p_categories))
    and (p_neighborhood is null or l.neighborhood_id = p_neighborhood)
    and (p_price_min is null or l.price >= p_price_min)
    and (p_price_max is null or l.price <= p_price_max)
    and (not p_available_only or l.availability_status = 'available')
    and (p_eq is null or l.attributes @> p_eq)
    and (p_text is null or not exists (
      select 1 from jsonb_each_text(p_text) t
      where public.search_normalize(l.attributes ->> t.key) is distinct from public.search_normalize(t.value)
    ))
    and (p_min is null or not exists (
      select 1 from jsonb_each_text(p_min) t
      where not coalesce(jsonb_typeof(l.attributes -> t.key) = 'number' and (l.attributes ->> t.key)::numeric >= t.value::numeric, false)
    ))
    and (p_max is null or not exists (
      select 1 from jsonb_each_text(p_max) t
      where not coalesce(jsonb_typeof(l.attributes -> t.key) = 'number' and (l.attributes ->> t.key)::numeric <= t.value::numeric, false)
    ))
  order by
    case when p_sort = 'prix_asc' then l.price end asc nulls last,
    case when p_sort = 'prix_desc' then l.price end desc nulls last,
    case when p_sort = 'pertinence' and v_has_query then ts_rank_cd(l.search_vector, v_tsq, 32) end desc nulls last,
    coalesce(l.published_at, l.updated_at) desc,
    l.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.search_listings(uuid, text, uuid[], uuid, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, text, integer, integer) from public;
grant execute on function public.search_listings(uuid, text, uuid[], uuid, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, text, integer, integer) to anon, authenticated;
