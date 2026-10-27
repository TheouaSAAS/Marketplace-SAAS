-- =============================================================================
-- Correctif de create_cabin_operation : état initial typé (cabin_status).
-- =============================================================================
create or replace function public.create_cabin_operation(
  p_idempotency_key uuid,
  p_follow_token_hash text,
  p_user uuid,
  p_service public.cabin_service,
  p_network text,
  p_target_network text,
  p_offer uuid,
  p_recipient_masked text,
  p_recipient_fingerprint text,
  p_amount integer,
  p_expected_total integer,
  p_quote_expires_at timestamptz,
  p_live_available boolean
)
returns table (id uuid, reference text, status public.cabin_status, mode public.cabin_mode, total_xof integer, created boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_existing public.cabin_operations;
  v_settings public.cabin_service_settings;
  v_provider public.cabin_providers;
  v_network public.cabin_networks;
  v_offer public.cabin_offers;
  v_route public.cabin_transfer_routes;
  v_amount integer := p_amount;
  v_fee integer;
  v_mode public.cabin_mode := 'demo';
  v_op public.cabin_operations;
begin
  if not public.is_service_request() then
    raise exception 'Réservé au serveur de la plateforme.' using errcode = '42501';
  end if;

  -- Second envoi de la même confirmation : la même opération, rien de nouveau.
  select * into v_existing from public.cabin_operations o where o.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    return query select v_existing.id, v_existing.reference, v_existing.status, v_existing.mode, v_existing.total_xof, false;
    return;
  end if;

  if p_quote_expires_at <= now() then
    raise exception 'Le récapitulatif a expiré : vérifiez de nouveau le montant.' using errcode = 'P0001', hint = 'DEVIS_EXPIRE';
  end if;
  select * into v_settings from public.cabin_service_settings s where s.service = p_service;
  if v_settings.service is null or not v_settings.is_enabled then
    raise exception 'Ce service est momentanément indisponible.' using errcode = 'P0001', hint = 'SERVICE_FERME';
  end if;
  select * into v_network from public.cabin_networks n where n.code = p_network;
  if v_network.code is null or not v_network.is_active then
    raise exception 'Ce réseau est momentanément indisponible.' using errcode = 'P0001', hint = 'RESEAU_FERME';
  end if;
  if (p_service in ('airtime', 'airtime_transfer', 'data') and v_network.kind <> 'telecom')
     or (p_service = 'electricity' and v_network.kind <> 'utility')
     or (p_service = 'money_transfer' and v_network.kind <> 'mobile_money') then
    raise exception 'Réseau incompatible avec ce service.' using errcode = 'P0001', hint = 'RESEAU_INCOMPATIBLE';
  end if;

  if p_service = 'data' then
    select * into v_offer from public.cabin_offers o where o.id = p_offer and o.is_active and o.network_code = p_network;
    if v_offer.id is null then
      raise exception 'Cette offre n''est plus proposée.' using errcode = 'P0001', hint = 'OFFRE_INDISPONIBLE';
    end if;
    v_amount := v_offer.price_xof;
  end if;
  if p_service = 'money_transfer' then
    select * into v_route from public.cabin_transfer_routes r where r.source_code = p_network and r.target_code = p_target_network;
    if v_route.source_code is null then
      raise exception 'Combinaison de réseaux inconnue.' using errcode = 'P0001', hint = 'ROUTE_INCONNUE';
    end if;
  end if;
  if v_amount < v_settings.min_amount_xof or v_amount > v_settings.max_amount_xof then
    raise exception 'Montant hors des limites du service (% à % F CFA).', v_settings.min_amount_xof, v_settings.max_amount_xof using errcode = 'P0001', hint = 'MONTANT_HORS_LIMITES';
  end if;

  v_fee := public.cabin_fee(v_amount, v_settings.fee_bps);
  -- Le total confirmé par le visiteur doit être celui calculé ici, au franc près.
  if p_expected_total is distinct from v_amount + v_fee then
    raise exception 'Le montant a changé : vérifiez le nouveau récapitulatif avant de confirmer.' using errcode = 'P0001', hint = 'MONTANT_CHANGE';
  end if;

  -- Mode réel seulement : prestataire actif en mode réel, intégration disponible côté serveur,
  -- et, pour un transfert, combinaison activée pour ce prestataire.
  if v_settings.provider_code is not null then
    select * into v_provider from public.cabin_providers p where p.code = v_settings.provider_code;
  end if;
  if p_live_available and v_provider.code is not null and v_provider.is_active and v_provider.mode = 'live'
     and p_service = any (v_provider.services)
     and (p_service <> 'money_transfer' or (v_route.is_enabled and v_route.provider_code = v_provider.code)) then
    v_mode := 'live';
  end if;

  insert into public.cabin_operations (idempotency_key, follow_token_hash, user_id, service, network_code, target_network_code, offer_id,
                                       recipient_masked, recipient_fingerprint, amount_xof, fee_bps, service_fee_xof, provider_fee_xof, total_xof,
                                       mode, provider_code, status, status_reason, quote_expires_at)
  values (p_idempotency_key, p_follow_token_hash, p_user, p_service, p_network, p_target_network, v_offer.id,
          p_recipient_masked, p_recipient_fingerprint, v_amount, v_settings.fee_bps, v_fee, 0, v_amount + v_fee,
          v_mode, case when v_mode = 'live' then v_provider.code end,
          (case when v_mode = 'live' then 'pending' else 'cancelled' end)::public.cabin_status,
          case when v_mode = 'demo' then 'Démonstration : aucun prestataire n’est connecté, aucune somme n’a été débitée ni aucun service fourni.' end,
          p_quote_expires_at)
  returning * into v_op;

  insert into public.cabin_operation_events (operation_id, from_status, to_status, source, detail)
  values (v_op.id, null, 'created', 'visiteur', 'Récapitulatif confirmé');
  insert into public.cabin_operation_events (operation_id, from_status, to_status, source, detail)
  values (v_op.id, 'created', v_op.status, 'serveur', coalesce(v_op.status_reason, 'Transmise au prestataire'));

  return query select v_op.id, v_op.reference, v_op.status, v_op.mode, v_op.total_xof, true;
end;
$$;
