-- =============================================================================
-- Niveau 14 : modification d'une fiche quartier par l'équipe locale, avec une
-- note conservée dans l'historique des révisions (avant / après).
-- =============================================================================
create or replace function public.save_neighborhood(
  p_id uuid,
  p_name text,
  p_alt_names text[],
  p_description text,
  p_verification public.verification_status,
  p_source uuid,
  p_is_active boolean,
  p_make_me_steward boolean,
  p_change_note text
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_curator() then
    raise exception 'Réservé à l''équipe locale.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_change_note, ''))) < 3 then
    raise exception 'Décrivez la modification (3 caractères au moins).' using errcode = '23514';
  end if;
  perform set_config('app.change_reason', btrim(p_change_note), true);
  update public.neighborhoods
  set name = btrim(p_name),
      alt_names = coalesce(p_alt_names, '{}'),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      verification_status = p_verification,
      source_id = p_source,
      is_active = p_is_active,
      steward_id = case when p_make_me_steward then (select auth.uid()) else steward_id end,
      -- Une nouvelle vérification se date à nouveau (enforce_verification_rules).
      verified_at = case when p_verification = 'verified' then verified_at end,
      verified_by = case when p_verification = 'verified' then verified_by end
  where id = p_id;
  if not found then
    raise exception 'Quartier introuvable.' using errcode = '23514';
  end if;
end;
$$;
revoke execute on function public.save_neighborhood(uuid, text, text[], text, public.verification_status, uuid, boolean, boolean, text) from public, anon;
grant execute on function public.save_neighborhood(uuid, text, text[], text, public.verification_status, uuid, boolean, boolean, text) to authenticated;
