-- =============================================================================
-- Niveau 16 : position d'un événement en coordonnées (carte, itinéraire).
-- Droits de l'appelant : seulement un événement lisible par lui.
-- =============================================================================
create or replace function public.event_point(p_event uuid)
returns table (lat double precision, lng double precision, location_precision public.location_precision)
language sql stable security invoker set search_path = '' as $$
  select extensions.st_y(e.location::extensions.geometry), extensions.st_x(e.location::extensions.geometry), e.location_precision
  from public.events e
  where e.id = p_event and e.location is not null
$$;
revoke execute on function public.event_point(uuid) from public;
grant execute on function public.event_point(uuid) to anon, authenticated;
