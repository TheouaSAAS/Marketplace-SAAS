-- =============================================================================
-- Annonces en temps réel : chaque changement qui touche une annonce visible du
-- public (publication, modification, disponibilité, retrait, expiration,
-- suppression) est signalé sur le canal public « annonces ».
--
-- Le message ne contient que l'identifiant de l'annonce (déjà public) : les
-- pages se rechargent ensuite côté serveur, avec les droits de la personne
-- qui consulte. Rien n'est diffusé pour un brouillon ou une annonce en attente
-- de modération, et un échec de diffusion ne bloque jamais l'écriture.
-- =============================================================================

create or replace function public.broadcast_listing_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_was_public boolean := false;
  v_is_public boolean := false;
begin
  if tg_op <> 'INSERT' then
    v_was_public := old.status = 'published' and public.verification_publicly_visible(old.verification_status);
  end if;
  if tg_op <> 'DELETE' then
    v_is_public := new.status = 'published' and public.verification_publicly_visible(new.verification_status);
  end if;
  if not (v_was_public or v_is_public) then
    return null;
  end if;
  -- Compteurs (vues…) et champs internes : pas de rechargement des pages.
  if tg_op = 'UPDATE' and (old.title, old.description, old.price, old.price_unit, old.is_negotiable, old.status, old.availability_status,
                           old.available_from, old.expires_at, old.published_at, old.category_id, old.neighborhood_id, old.attributes,
                           old.verification_status, old.verified_at, old.last_confirmed_at, old.location_public, old.public_location_precision)
                          is not distinct from
                          (new.title, new.description, new.price, new.price_unit, new.is_negotiable, new.status, new.availability_status,
                           new.available_from, new.expires_at, new.published_at, new.category_id, new.neighborhood_id, new.attributes,
                           new.verification_status, new.verified_at, new.last_confirmed_at, new.location_public, new.public_location_precision) then
    return null;
  end if;
  begin
    perform realtime.send(jsonb_build_object('id', case when tg_op = 'DELETE' then old.id else new.id end), 'annonce', 'annonces', false);
  exception when others then
    raise warning 'Diffusion temps réel impossible : %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function public.broadcast_listing_change() from public, anon, authenticated;

drop trigger if exists listings_broadcast on public.listings;
create trigger listings_broadcast
  after insert or update or delete on public.listings
  for each row execute function public.broadcast_listing_change();
