-- =============================================================================
-- Niveau 22 (ajustement) : admin_set_account accepte de ne changer que le rôle
-- ou que la suspension (paramètres facultatifs ; la raison reste exigée).
-- =============================================================================
create or replace function public.admin_set_account(p_user uuid, p_role public.user_role default null, p_suspended boolean default null, p_reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas modifier votre propre compte.' using errcode = '42501';
  end if;
  perform set_config('app.change_reason', btrim(p_reason), true);
  update public.profiles
  set role = coalesce(p_role, role), is_suspended = coalesce(p_suspended, is_suspended)
  where id = p_user;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_set_account(uuid, public.user_role, boolean, text) from public, anon;
