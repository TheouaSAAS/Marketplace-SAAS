-- =============================================================================
-- Niveau 14 : historique des périmètres d'un quartier pour l'équipe locale
-- (brouillons à prévisualiser, versions validées, refusées, remplacées).
-- Droits de l'appelant : la table n'est lisible que par l'équipe locale.
-- =============================================================================
create or replace function public.neighborhood_boundary_history(p_neighborhood uuid)
returns table (
  id uuid, status text, note text, review_note text, proposed_at timestamptz, reviewed_at timestamptz,
  source_title text, area_km2 double precision, geojson text
)
language sql stable security invoker set search_path = '' as $$
  select b.id, b.status, b.note, b.review_note, b.proposed_at, b.reviewed_at, s.title,
         round((extensions.st_area(b.geometry) / 1000000)::numeric, 3)::double precision,
         extensions.st_asgeojson(b.geometry::extensions.geometry, 6)
  from public.neighborhood_boundaries b
  left join public.sources s on s.id = b.source_id
  where b.neighborhood_id = p_neighborhood
  order by b.proposed_at desc
  limit 50
$$;
revoke execute on function public.neighborhood_boundary_history(uuid) from public, anon;
grant execute on function public.neighborhood_boundary_history(uuid) to authenticated;
