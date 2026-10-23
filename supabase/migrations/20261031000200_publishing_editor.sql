-- =============================================================================
-- Niveau 18 : éditeur d'annonce — annulation d'une suggestion et position privée
-- =============================================================================

-- Valeur du champ AVANT l'application d'une suggestion : « Annuler » la restaure,
-- même après rechargement. Renseignée uniquement au moment de l'acceptation.
alter table public.listing_suggestions add column previous_value jsonb;

create or replace function public.protect_listing_suggestion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'proposee';
    new.decided_at := null;
    new.previous_value := null;
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'decided_at' - 'previous_value') is distinct from (to_jsonb(old) - 'status' - 'decided_at' - 'previous_value') then
    raise exception 'Une suggestion ne se modifie pas : acceptez-la, rejetez-la ou annulez-la.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'proposee' and new.status in ('acceptee', 'rejetee')) or (old.status = 'acceptee' and new.status = 'annulee')) then
      raise exception 'Décision non autorisée (% → %).', old.status, new.status using errcode = '42501';
    end if;
    new.decided_at := now();
  end if;
  if new.previous_value is distinct from old.previous_value and not (old.status = 'proposee' and new.status = 'acceptee') then
    new.previous_value := old.previous_value;
  end if;
  return new;
end;
$$;

-- Position saisie (privée) d'une annonce, pour son auteur ou l'équipe.
create or replace function public.listing_editor_point(p_listing uuid)
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select extensions.st_y(l.location::extensions.geometry), extensions.st_x(l.location::extensions.geometry)
  from public.listings l
  where l.id = p_listing and l.location is not null
    and (public.can_manage_content(l.owner_id, l.organization_id) or public.is_staff())
$$;
revoke all on function public.listing_editor_point(uuid) from public, anon;
grant execute on function public.listing_editor_point(uuid) to authenticated;
