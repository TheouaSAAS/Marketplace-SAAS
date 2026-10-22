-- =============================================================================
-- Niveau 10 : position publique d'une fiche professionnelle en coordonnées
-- (droits de l'appelant : jamais la position exacte si l'annonceur l'a masquée).
-- =============================================================================
create or replace function public.business_public_point(p_business uuid)
returns table (lat double precision, lng double precision, location_precision public.public_location_precision)
language sql stable security invoker set search_path = '' as $$
  select extensions.st_y(b.location_public::extensions.geometry), extensions.st_x(b.location_public::extensions.geometry), b.public_location_precision
  from public.business_profiles b
  where b.id = p_business and b.location_public is not null
$$;
revoke execute on function public.business_public_point(uuid) from public;
grant execute on function public.business_public_point(uuid) to anon, authenticated;
