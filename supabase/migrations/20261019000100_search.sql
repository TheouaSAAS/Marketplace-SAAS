-- =============================================================================
-- Niveau 7 : moteur de recherche transversal.
--
-- Une seule logique de correspondance pour tous les types de contenus, exécutée
-- avec les droits de l'appelant (SECURITY INVOKER) : les règles d'accès et les
-- droits par colonne s'appliquent (jamais de position exacte ni de contact
-- d'annonce). Seuls les contenus publiés sont renvoyés, même à leur auteur.
-- =============================================================================

-- Requête texte : mots normalisés (minuscules, sans accents), recherchés comme
-- préfixes et tous requis (« stud loue » trouve « Studio à louer »).
create or replace function public.search_tsquery(p_query text)
returns tsquery
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when words = '' then null else to_tsquery('french', words) end
  from (
    select coalesce(string_agg(w || ':*', ' & '), '') as words
    from regexp_split_to_table(lower(public.immutable_unaccent(coalesce(p_query, ''))), '[^a-z0-9]+') as w
    where length(w) >= 2
  ) s
$$;

-- Texte normalisé pour la correspondance approchée (fautes de frappe).
create or replace function public.search_normalize(p_query text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(public.immutable_unaccent(coalesce(p_query, ''))), '[^a-z0-9]+', ' ', 'g'))
$$;

-- Correspondance approchée sur les titres : index trigrammes manquants.
create index if not exists listings_title_trgm on public.listings using gin (public.immutable_unaccent(title) extensions.gin_trgm_ops);
create index if not exists events_title_trgm on public.events using gin (public.immutable_unaccent(title) extensions.gin_trgm_ops);
create index if not exists guide_articles_title_trgm on public.guide_articles using gin (public.immutable_unaccent(title) extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Correspondances d'un type de contenu, sans pagination.
--   p_type : annonces | lieux | professionnels | evenements | guide
-- Les filtres qui ne s'appliquent pas à un type sont ignorés pour ce type
-- (l'interface ne les propose que là où ils ont un sens).
-- -----------------------------------------------------------------------------
create or replace function public.search_matches(
  p_type text,
  p_city uuid,
  p_query text default null,
  p_categories uuid[] default null,
  p_neighborhood uuid default null,
  p_verified_only boolean default false,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_available_only boolean default false,
  p_seller text default null,
  p_starts_from timestamptz default null,
  p_starts_to timestamptz default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null
)
returns table (
  id uuid,
  rank real,
  distance_m double precision,
  price numeric,
  starts_at timestamptz,
  recency timestamptz,
  boost integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tsq tsquery := public.search_tsquery(p_query);
  v_norm text := public.search_normalize(p_query);
  v_has_query boolean := public.search_normalize(p_query) <> '';
  v_point extensions.geography := case
    when p_lat between -90 and 90 and p_lng between -180 and 180
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  end;
  v_radius integer := case when p_radius_m between 100 and 100000 then p_radius_m end;
  v_today timestamptz := date_trunc('day', now());
begin
  if p_type not in ('annonces', 'lieux', 'professionnels', 'evenements', 'guide') then
    raise exception 'Type de recherche inconnu : %', p_type using errcode = '22023';
  end if;
  if p_seller is not null and p_seller not in ('particulier', 'professionnel') then
    raise exception 'Type d''annonceur inconnu : %', p_seller using errcode = '22023';
  end if;
  -- Sans position autorisée, aucun filtre de distance.
  if v_point is null then
    v_radius := null;
  end if;

  if p_type = 'annonces' then
    return query
    select l.id,
      (coalesce(ts_rank_cd(l.search_vector, v_tsq, 32), 0)
        + case when v_has_query then extensions.word_similarity(v_norm, public.immutable_unaccent(l.title)) * 0.5 else 0 end)::real,
      case when v_point is not null and l.location_public is not null then extensions.st_distance(l.location_public, v_point) end,
      l.price, null::timestamptz, l.published_at, 0
    from public.listings l
    where l.city_id = p_city
      and l.status = 'published'
      and (l.expires_at is null or l.expires_at > now())
      and (not v_has_query or (v_tsq is not null and l.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(l.title))
      and (p_categories is null or l.category_id = any (p_categories))
      and (p_neighborhood is null or l.neighborhood_id = p_neighborhood)
      and (not p_verified_only or (l.verification_status = 'verified' and l.verified_at >= now() - interval '365 days'))
      and (p_price_min is null or l.price >= p_price_min)
      and (p_price_max is null or l.price <= p_price_max)
      and (not p_available_only or l.availability_status = 'available')
      and (p_seller is null or (p_seller = 'professionnel') = (l.organization_id is not null or l.business_id is not null))
      and (v_radius is null or (l.location_public is not null and extensions.st_dwithin(l.location_public, v_point, v_radius)));

  elsif p_type = 'lieux' then
    return query
    select p.id,
      (coalesce(ts_rank_cd(p.search_vector, v_tsq, 32), 0)
        + case when v_has_query then extensions.word_similarity(v_norm, public.immutable_unaccent(p.name)) * 0.5 else 0 end)::real,
      case when v_point is not null and p.location is not null then extensions.st_distance(p.location, v_point) end,
      null::numeric, null::timestamptz, p.updated_at,
      case when p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days' then 1 else 0 end
    from public.places p
    where p.city_id = p_city
      and p.status = 'published'
      and (not v_has_query or (v_tsq is not null and p.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(p.name))
      and (p_categories is null or p.category_id = any (p_categories))
      and (p_neighborhood is null or p.neighborhood_id = p_neighborhood)
      and (not p_verified_only or (p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days'))
      and (v_radius is null or (p.location is not null and extensions.st_dwithin(p.location, v_point, v_radius)));

  elsif p_type = 'professionnels' then
    return query
    select b.id,
      (coalesce(ts_rank_cd(b.search_vector, v_tsq, 32), 0)
        + case when v_has_query then extensions.word_similarity(v_norm, public.immutable_unaccent(b.name)) * 0.5 else 0 end)::real,
      case when v_point is not null and b.location_public is not null then extensions.st_distance(b.location_public, v_point) end,
      null::numeric, null::timestamptz, b.updated_at,
      case when b.verification_status = 'verified' and b.verified_at >= now() - interval '365 days' then 1 else 0 end
    from public.business_profiles b
    where b.city_id = p_city
      and b.status = 'published'
      and (not v_has_query or (v_tsq is not null and b.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(b.name))
      and (p_categories is null or b.category_id = any (p_categories))
      and (p_neighborhood is null or b.neighborhood_id = p_neighborhood)
      and (not p_verified_only or (b.verification_status = 'verified' and b.verified_at >= now() - interval '365 days'))
      and (v_radius is null or (b.location_public is not null and extensions.st_dwithin(b.location_public, v_point, v_radius)));

  elsif p_type = 'evenements' then
    return query
    select e.id,
      (coalesce(ts_rank_cd(e.search_vector, v_tsq, 32), 0)
        + case when v_has_query then extensions.word_similarity(v_norm, public.immutable_unaccent(e.title)) * 0.5 else 0 end)::real,
      case when v_point is not null and e.location is not null then extensions.st_distance(e.location, v_point) end,
      e.price_min::numeric, e.starts_at, e.published_at, 0
    from public.events e
    where e.city_id = p_city
      and e.status = 'published'
      -- Jamais d'événement terminé.
      and (e.ends_at >= now() or (e.ends_at is null and e.starts_at >= v_today))
      and (not v_has_query or (v_tsq is not null and e.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(e.title))
      and (p_categories is null or e.category_id = any (p_categories))
      and (p_neighborhood is null or e.neighborhood_id = p_neighborhood)
      and (not p_verified_only or (e.verification_status = 'verified' and e.verified_at >= now() - interval '30 days'))
      -- Période : l'événement a lieu au moins en partie dans [début, fin[.
      and (p_starts_to is null or e.starts_at < p_starts_to)
      and (p_starts_from is null or coalesce(e.ends_at, e.starts_at) >= p_starts_from)
      and (v_radius is null or (e.location is not null and extensions.st_dwithin(e.location, v_point, v_radius)));

  else
    return query
    select g.id,
      (coalesce(ts_rank_cd(g.search_vector, v_tsq, 32), 0)
        + case when v_has_query then extensions.word_similarity(v_norm, public.immutable_unaccent(g.title)) * 0.5 else 0 end)::real,
      null::double precision, null::numeric, null::timestamptz, coalesce(g.published_at, g.updated_at),
      case when g.verification_status = 'verified' and g.verified_at >= now() - interval '365 days' then 1 else 0 end
    from public.guide_articles g
    where g.city_id = p_city
      and g.status = 'published'
      and (not v_has_query or (v_tsq is not null and g.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(g.title))
      and (not p_verified_only or (g.verification_status = 'verified' and g.verified_at >= now() - interval '365 days'))
      -- Un article du guide n'a ni quartier ni position : ces filtres l'excluent.
      and p_neighborhood is null
      and v_radius is null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Page de résultats d'un type, triée selon des règles publiques :
--   proximite  : distance croissante (sans position : sans effet)
--   prix_asc / prix_desc : prix déclaré (annonces ; prix inconnu en dernier)
--   date       : date de début (événements)
--   recent     : publication ou mise à jour la plus récente
--   pertinence : correspondance du texte (titre avant description)
-- Départage commun : événements par date ; vérification à jour (lieux,
-- professionnels, guide) ; puis le plus récent.
-- -----------------------------------------------------------------------------
create or replace function public.search_content(
  p_type text,
  p_city uuid,
  p_query text default null,
  p_categories uuid[] default null,
  p_neighborhood uuid default null,
  p_verified_only boolean default false,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_available_only boolean default false,
  p_seller text default null,
  p_starts_from timestamptz default null,
  p_starts_to timestamptz default null,
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
  select m.id, m.distance_m, count(*) over ()
  from public.search_matches(p_type, p_city, p_query, p_categories, p_neighborhood, p_verified_only, p_price_min, p_price_max,
    p_available_only, p_seller, p_starts_from, p_starts_to, p_lat, p_lng, p_radius_m) m
  order by
    case when p_sort = 'proximite' then m.distance_m end asc nulls last,
    case when p_sort = 'prix_asc' then m.price end asc nulls last,
    case when p_sort = 'prix_desc' then m.price end desc nulls last,
    case when p_sort = 'date' then m.starts_at end asc nulls last,
    case when p_sort = 'recent' then m.recency end desc nulls last,
    case when p_sort = 'pertinence' then m.rank end desc nulls last,
    m.starts_at asc nulls last,
    m.boost desc,
    m.recency desc nulls last,
    m.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- Nombre de résultats par type pour les filtres communs (onglets).
create or replace function public.search_counts(
  p_city uuid,
  p_query text default null,
  p_neighborhood uuid default null,
  p_verified_only boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null
)
returns table (type text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.type, (
    select count(*)
    from public.search_matches(t.type, p_city, p_query, null, p_neighborhood, p_verified_only,
      p_lat => p_lat, p_lng => p_lng, p_radius_m => p_radius_m)
  )
  from unnest(array['annonces', 'lieux', 'professionnels', 'evenements', 'guide']) with ordinality as t(type, n)
  order by t.n
$$;

revoke execute on function public.search_matches(text, uuid, text, uuid[], uuid, boolean, numeric, numeric, boolean, text, timestamptz, timestamptz, double precision, double precision, integer) from public;
revoke execute on function public.search_content(text, uuid, text, uuid[], uuid, boolean, numeric, numeric, boolean, text, timestamptz, timestamptz, double precision, double precision, integer, text, integer, integer) from public;
revoke execute on function public.search_counts(uuid, text, uuid, boolean, double precision, double precision, integer) from public;
grant execute on function public.search_matches(text, uuid, text, uuid[], uuid, boolean, numeric, numeric, boolean, text, timestamptz, timestamptz, double precision, double precision, integer) to anon, authenticated;
grant execute on function public.search_content(text, uuid, text, uuid[], uuid, boolean, numeric, numeric, boolean, text, timestamptz, timestamptz, double precision, double precision, integer, text, integer, integer) to anon, authenticated;
grant execute on function public.search_counts(uuid, text, uuid, boolean, double precision, double precision, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Statistiques de recherche respectueuses de la vie privée.
-- Agrégats quotidiens uniquement : ni compte, ni adresse IP, ni position, ni
-- identifiant de session. Les suites de chiffres (téléphones, montants) et les
-- adresses e-mail sont masquées avant comptage. Conservation : 180 jours.
-- -----------------------------------------------------------------------------
create table public.search_stats (
  day date not null default current_date,
  city_id uuid not null references public.cities (id) on delete cascade,
  search_type text not null check (search_type in ('apercu', 'annonces', 'lieux', 'professionnels', 'evenements', 'guide')),
  query_norm text not null check (char_length(query_norm) <= 80),
  searches integer not null default 0 check (searches >= 0),
  zero_results integer not null default 0 check (zero_results >= 0),
  primary key (day, city_id, search_type, query_norm)
);
alter table public.search_stats enable row level security;
create policy search_stats_admin_read on public.search_stats for select to authenticated using ((select public.is_admin()));

create or replace function public.search_anonymize(p_query text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select left(btrim(regexp_replace(regexp_replace(regexp_replace(
    lower(public.immutable_unaccent(coalesce(p_query, ''))),
    '\S+@\S+', '[e-mail]', 'g'),
    '[0-9][0-9 .]{2,}[0-9]', '[nombre]', 'g'),
    '\s+', ' ', 'g')), 80)
$$;

create or replace function public.record_search(p_city uuid, p_type text, p_query text, p_results integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.search_stats as s (city_id, search_type, query_norm, searches, zero_results)
  values (p_city, p_type, public.search_anonymize(p_query), 1, case when coalesce(p_results, 0) = 0 then 1 else 0 end)
  on conflict (day, city_id, search_type, query_norm) do update
    set searches = s.searches + 1, zero_results = s.zero_results + excluded.zero_results
$$;
-- Appelée uniquement par le serveur de l'application (clé secrète).
revoke execute on function public.record_search(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.record_search(uuid, text, text, integer) to service_role;

select cron.schedule('purger-statistiques-recherche', '30 3 * * *', $$delete from public.search_stats where day < current_date - 180$$);

-- -----------------------------------------------------------------------------
-- Recherches sauvegardées : nombre limité par compte.
-- -----------------------------------------------------------------------------
create or replace function public.limit_saved_searches()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_searches where user_id = new.user_id) >= 20 then
    raise exception 'Vous avez atteint la limite de 20 recherches enregistrées.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger saved_searches_limit before insert on public.saved_searches
  for each row execute function public.limit_saved_searches();
