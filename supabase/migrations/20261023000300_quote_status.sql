-- =============================================================================
-- Niveau 10 : suivi des demandes de contact et de devis.
-- Le destinataire peut seulement changer le statut d'une demande (lue,
-- répondue, archivée) : le message, les coordonnées et l'accord de
-- transmission restent tels que l'expéditeur les a envoyés.
-- =============================================================================

create or replace function public.protect_contact_request_content()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_service_context() or public.is_service_request() or public.is_staff() then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
    raise exception 'Seul le statut d''une demande peut être modifié.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger contact_requests_protect_content before update on public.contact_requests
  for each row execute function public.protect_contact_request_content();
