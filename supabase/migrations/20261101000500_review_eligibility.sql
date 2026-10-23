-- =============================================================================
-- Niveau 19 : l'éligibilité à publier un avis est vérifiée avec les droits de
-- l'auteur (règle appelée par le déclencheur des avis). Elle ne répond que pour
-- le compte connecté : impossible de sonder l'ancienneté d'un autre compte.
-- =============================================================================
create or replace function public.account_can_review(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user = (select auth.uid()) and exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null
  )
$$;
grant execute on function public.account_can_review(uuid) to authenticated;
