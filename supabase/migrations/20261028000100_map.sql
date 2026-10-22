-- =============================================================================
-- Niveau 15 : carte interactive.
-- Une seule fonction, aux droits de l'appelant, renvoie les éléments d'une zone
-- par couche, avec UNIQUEMENT des coordonnées publiables :
--   annonces et fiches pro : `location_public` (déjà dégradée selon le choix de
--   l'annonceur ; absente si « quartier seulement » ou « masquée ») ;
--   lieux (commerces, tourisme) et événements : position de la fiche publique.
-- Chaque élément garde son type, son identifiant et son statut de vérification
-- (traçabilité : la fiche affiche sa source).
-- =============================================================================
create or replace function public.map_features(
  p_city uuid,
  p_layers text[],
  p_west double precision default null,
  p_south double precision default null,
  p_east double precision default null,
  p_north double precision default null,
  p_neighborhood uuid default null,
  p_limit integer default 300
)
returns table (
  layer text, id uuid, slug text, title text, category text, verification_status public.verification_status, verified_at timestamptz,
  location_precision text, lat double precision, lng double precision, neighborhood text, starts_at timestamptz, total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive tree as (
    select c.slug as root, c.id from public.categories c
    where c.slug in ('immobilier', 'emploi-stages', 'services-professionnels', 'transport-livraison', 'commerces-boutiques',
                     'restaurants-gastronomie', 'lieux-a-visiter', 'plages-sites-naturels', 'hotels-hebergements', 'loisirs-activites', 'excursions-guides')
    union all
    select t.root, c.id from public.categories c join tree t on c.parent_id = t.id
  ),
  layer_of as (
    select id, case
      when root = 'immobilier' then 'immobilier'
      when root = 'emploi-stages' then 'emploi'
      when root in ('services-professionnels', 'transport-livraison') then 'services'
      when root in ('commerces-boutiques', 'restaurants-gastronomie') then 'commerces'
      else 'tourisme' end as layer
    from tree
  ),
  zone as (
    select case when p_west between -180 and 180 and p_east between -180 and 180 and p_south between -90 and 90 and p_north between -90 and 90
                     and p_west < p_east and p_south < p_north
                then extensions.st_makeenvelope(p_west, p_south, p_east, p_north, 4326) end as box
  ),
  features as (
    select lo.layer, l.id, l.slug, l.title, c.name as category, l.verification_status, l.verified_at,
           l.public_location_precision::text as location_precision, l.location_public as geo, n.name as neighborhood, null::timestamptz as starts_at,
           l.neighborhood_id, coalesce(l.published_at, l.updated_at) as freshness
    from public.listings l
    join layer_of lo on lo.id = l.category_id and lo.layer in ('immobilier', 'emploi')
    join public.categories c on c.id = l.category_id
    left join public.neighborhoods n on n.id = l.neighborhood_id
    where l.city_id = p_city and l.status = 'published' and l.location_public is not null
    union all
    select lo.layer, b.id, b.slug, b.name, c.name, b.verification_status, b.verified_at,
           b.public_location_precision::text, b.location_public, n.name, null, b.neighborhood_id, b.updated_at
    from public.business_profiles b
    join layer_of lo on lo.id = b.category_id and lo.layer = 'services'
    join public.categories c on c.id = b.category_id
    left join public.neighborhoods n on n.id = b.neighborhood_id
    where b.city_id = p_city and b.status = 'published' and b.location_public is not null
    union all
    select lo.layer, p.id, p.slug, p.name, c.name, p.verification_status, p.verified_at,
           p.location_precision::text, p.location, n.name, null, p.neighborhood_id, p.updated_at
    from public.places p
    join layer_of lo on lo.id = p.category_id and lo.layer in ('commerces', 'tourisme')
    join public.categories c on c.id = p.category_id
    left join public.neighborhoods n on n.id = p.neighborhood_id
    where p.city_id = p_city and p.status = 'published' and p.location is not null
    union all
    select 'evenements', e.id, e.slug, e.title, c.name, e.verification_status, e.verified_at,
           e.location_precision::text, e.location, n.name, e.starts_at, e.neighborhood_id, e.starts_at
    from public.events e
    left join public.categories c on c.id = e.category_id
    left join public.neighborhoods n on n.id = e.neighborhood_id
    where e.city_id = p_city and e.status = 'published' and e.location is not null
      and coalesce(e.ends_at, e.starts_at) >= now()
  )
  select f.layer, f.id, f.slug, f.title, f.category, f.verification_status, f.verified_at, f.location_precision,
         extensions.st_y(f.geo::extensions.geometry), extensions.st_x(f.geo::extensions.geometry), f.neighborhood, f.starts_at,
         count(*) over ()
  from features f, zone z
  where f.layer = any (p_layers)
    and (z.box is null or extensions.st_intersects(f.geo::extensions.geometry, z.box))
    and (p_neighborhood is null or f.neighborhood_id = p_neighborhood)
  order by (f.verification_status = 'verified') desc, f.freshness desc nulls last, f.id
  limit least(greatest(coalesce(p_limit, 300), 1), 500)
$$;
revoke execute on function public.map_features(uuid, text[], double precision, double precision, double precision, double precision, uuid, integer) from public;
grant execute on function public.map_features(uuid, text[], double precision, double precision, double precision, double precision, uuid, integer) to anon, authenticated;
