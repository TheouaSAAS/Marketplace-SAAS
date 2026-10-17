-- =============================================================================
-- Correctif : écriture du journal d'administration par un simple membre.
--
-- Défaut détecté par supabase/tests/security.sql sur la base réelle :
-- log_admin_action() est SECURITY DEFINER ; à l'intérieur, current_user vaut
-- le propriétaire de la fonction, donc is_service_context() répondait
-- toujours vrai et n'importe quel membre pouvait journaliser.
--
-- Règle désormais : dans une fonction SECURITY DEFINER, le contexte système se
-- reconnaît au rôle du jeton (auth.role() = 'service_role'), jamais à current_user.
-- =============================================================================

create or replace function public.is_service_request()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.role()) = 'service_role', false)
$$;

comment on function public.is_service_request() is
  'Vrai pour une requête authentifiée par la clé secrète. Utilisable dans les fonctions SECURITY DEFINER.';
comment on function public.is_service_context() is
  'Vrai pour le rôle SQL courant service_role/postgres. NE PAS utiliser dans une fonction SECURITY DEFINER (current_user y vaut le propriétaire) : utiliser is_service_request().';

create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_staff() or public.is_service_request()) then
    raise exception 'Action réservée à l''équipe.' using errcode = '42501';
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;
