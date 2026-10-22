-- =============================================================================
-- Niveau 14 : vue d'ensemble des quartiers d'une ville en un seul appel
-- (noms, statut, périmètre validé, nombre de contenus publiés rattachés).
-- Droits de l'appelant : seuls les quartiers et contenus lisibles sont comptés.
-- =============================================================================
create or replace function public.neighborhood_overview(p_city uuid)
returns table (
  id uuid, slug text, name text, alt_names text[], verification_status public.verification_status, verified_at timestamptz,
  bounded boolean, total bigint
)
language sql stable security invoker set search_path = '' as $$
  select n.id, n.slug, n.name, n.alt_names, n.verification_status, n.verified_at, n.boundary_validated_at is not null,
    (select count(*) from public.listings l where l.neighborhood_id = n.id and l.status = 'published')
    + (select count(*) from public.business_profiles b where b.neighborhood_id = n.id and b.status = 'published')
    + (select count(*) from public.places p where p.neighborhood_id = n.id and p.status = 'published')
    + (select count(*) from public.events e where e.neighborhood_id = n.id and e.status = 'published' and coalesce(e.ends_at, e.starts_at) >= now())
  from public.neighborhoods n
  where n.city_id = p_city and n.is_active
  order by n.name collate "C"
$$;
revoke execute on function public.neighborhood_overview(uuid) from public;
grant execute on function public.neighborhood_overview(uuid) to anon, authenticated;
