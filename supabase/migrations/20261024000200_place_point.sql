-- =============================================================================
-- Niveau 11 : position d'une vitrine en coordonnées (carte, itinéraire).
-- Droits de l'appelant : seulement une vitrine lisible par lui.
-- =============================================================================
create or replace function public.place_point(p_place uuid)
returns table (lat double precision, lng double precision, location_precision public.location_precision)
language sql stable security invoker set search_path = '' as $$
  select extensions.st_y(p.location::extensions.geometry), extensions.st_x(p.location::extensions.geometry), p.location_precision
  from public.places p
  where p.id = p_place and p.location is not null
$$;
revoke execute on function public.place_point(uuid) from public;
grant execute on function public.place_point(uuid) to anon, authenticated;
