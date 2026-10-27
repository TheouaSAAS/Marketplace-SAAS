-- =============================================================================
-- Cabine en ligne : crédit et unités, offres Internet, recharge CIE, transferts
-- entre réseaux de mobile money.
--
-- Principes garantis ici :
-- - frais de service calculés par la base (taux en points de base, 50 = 0,5 %,
--   arrondi au franc CFA entier le plus proche, demi-franc vers le haut) ;
-- - aucun catalogue d'offres ni combinaison de transfert inventé : tables vides
--   ou désactivées tant que l'administration ne les renseigne pas ;
-- - une opération n'est « réussie » qu'en mode réel, avec une référence du
--   prestataire (contrainte) ; une opération de démonstration ne l'est jamais ;
-- - une même clé d'idempotence ne crée jamais deux opérations ;
-- - aucune donnée de paiement sensible (PIN, mot de passe) n'a de colonne.
-- =============================================================================

create type public.cabin_service as enum ('airtime', 'airtime_transfer', 'data', 'electricity', 'money_transfer');
create type public.cabin_status as enum ('created', 'pending', 'processing', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded');
create type public.cabin_mode as enum ('demo', 'live');

-- Prestataires techniques ou de paiement (contrat, clés côté serveur seulement).
create table public.cabin_providers (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text check (char_length(description) <= 500),
  services public.cabin_service[] not null default '{}',
  -- « live » n'a d'effet que si l'intégration existe dans le code et que ses clés sont configurées.
  mode public.cabin_mode not null default 'demo',
  is_active boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.cabin_networks (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  kind text not null check (kind in ('telecom', 'mobile_money', 'utility')),
  is_active boolean not null default true,
  sort_order integer not null default 100
);

create table public.cabin_service_settings (
  service public.cabin_service primary key,
  label text not null,
  description text not null,
  is_enabled boolean not null default true,
  -- Frais de service en points de base : 50 = 0,5 %.
  fee_bps integer not null default 50 check (fee_bps between 0 and 1000),
  min_amount_xof integer not null check (min_amount_xof > 0),
  max_amount_xof integer not null check (max_amount_xof >= min_amount_xof),
  provider_code text references public.cabin_providers (code) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Catalogue des offres Internet : fourni par l'opérateur ou saisi par l'administration, jamais inventé.
create table public.cabin_offers (
  id uuid primary key default gen_random_uuid(),
  network_code text not null references public.cabin_networks (code) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  price_xof integer not null check (price_xof > 0),
  data_volume text check (char_length(data_volume) <= 40),
  validity text check (char_length(validity) <= 40),
  -- Origine du tarif (catalogue du prestataire, grille officielle de l'opérateur…) et date de relevé.
  source text not null check (char_length(source) between 3 and 300),
  checked_on date not null default current_date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Combinaisons de transfert entre réseaux : désactivées tant qu'un prestataire ne les prend pas en charge.
create table public.cabin_transfer_routes (
  source_code text not null references public.cabin_networks (code) on delete cascade,
  target_code text not null references public.cabin_networks (code) on delete cascade,
  provider_code text references public.cabin_providers (code) on delete set null,
  is_enabled boolean not null default false,
  note text check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (source_code, target_code),
  check (source_code <> target_code),
  check (not is_enabled or provider_code is not null)
);

create table public.cabin_operations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('CAB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  -- Clé fournie par le navigateur pour une confirmation : un second envoi renvoie la même opération.
  idempotency_key uuid not null unique,
  -- Empreinte du jeton de suivi remis au visiteur (le jeton lui-même n'est jamais conservé).
  follow_token_hash text not null check (follow_token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid references public.profiles (id) on delete set null,
  service public.cabin_service not null,
  network_code text not null references public.cabin_networks (code),
  target_network_code text references public.cabin_networks (code),
  offer_id uuid references public.cabin_offers (id) on delete set null,
  -- Numéro ou compteur masqué (affichage) et empreinte HMAC (limites anti-abus), jamais en clair.
  recipient_masked text not null check (char_length(recipient_masked) <= 40),
  recipient_fingerprint text not null check (recipient_fingerprint ~ '^[0-9a-f]{64}$'),
  amount_xof integer not null check (amount_xof > 0),
  fee_bps integer not null check (fee_bps between 0 and 1000),
  service_fee_xof integer not null check (service_fee_xof >= 0),
  provider_fee_xof integer not null default 0 check (provider_fee_xof >= 0),
  total_xof integer not null,
  mode public.cabin_mode not null,
  provider_code text references public.cabin_providers (code),
  provider_reference text unique,
  status public.cabin_status not null default 'created',
  status_reason text check (char_length(status_reason) <= 500),
  -- Code ou jeton de recharge renvoyé par le prestataire (CIE) : jamais fabriqué, jamais en mode démonstration.
  delivery_code text check (delivery_code is null or mode = 'live'),
  quote_expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_xof = amount_xof + service_fee_xof + provider_fee_xof),
  check (service <> 'money_transfer' or (target_network_code is not null and target_network_code <> network_code)),
  -- Réussite seulement confirmée par un prestataire réel.
  check (status <> 'succeeded' or (mode = 'live' and provider_reference is not null and completed_at is not null))
);
create index cabin_operations_created_idx on public.cabin_operations (created_at desc);
create index cabin_operations_status_idx on public.cabin_operations (status, created_at desc);
create index cabin_operations_user_idx on public.cabin_operations (user_id, created_at desc) where user_id is not null;
create trigger cabin_operations_updated_at before update on public.cabin_operations for each row execute function public.set_updated_at();

create table public.cabin_operation_events (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.cabin_operations (id) on delete cascade,
  from_status public.cabin_status,
  to_status public.cabin_status not null,
  source text not null check (source in ('visiteur', 'serveur', 'prestataire', 'administration', 'systeme')),
  detail text check (char_length(detail) <= 500),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index cabin_operation_events_operation_idx on public.cabin_operation_events (operation_id, created_at);

-- Accès -----------------------------------------------------------------------
alter table public.cabin_providers enable row level security;
alter table public.cabin_networks enable row level security;
alter table public.cabin_service_settings enable row level security;
alter table public.cabin_offers enable row level security;
alter table public.cabin_transfer_routes enable row level security;
alter table public.cabin_operations enable row level security;
alter table public.cabin_operation_events enable row level security;

-- Configuration : lisible par tous (aucune donnée sensible), modifiable par les administrateurs.
create policy cabin_providers_read on public.cabin_providers for select using (true);
create policy cabin_providers_admin on public.cabin_providers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cabin_networks_read on public.cabin_networks for select using (true);
create policy cabin_networks_admin on public.cabin_networks for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cabin_services_read on public.cabin_service_settings for select using (true);
create policy cabin_services_admin on public.cabin_service_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cabin_offers_read on public.cabin_offers for select using (is_active or (select public.is_admin()));
create policy cabin_offers_admin on public.cabin_offers for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy cabin_routes_read on public.cabin_transfer_routes for select using (true);
create policy cabin_routes_admin on public.cabin_transfer_routes for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
-- Opérations : la personne connectée voit les siennes, l'administration toutes ; aucune écriture directe.
create policy cabin_operations_read on public.cabin_operations for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy cabin_events_read on public.cabin_operation_events for select to authenticated using ((select public.is_admin()));

revoke all on public.cabin_operations, public.cabin_operation_events from anon, authenticated;
grant select on public.cabin_operations, public.cabin_operation_events to authenticated;

-- Calculs ----------------------------------------------------------------------
-- Frais de service : arrondi au franc CFA entier le plus proche (demi-franc vers le haut).
create or replace function public.cabin_fee(p_amount integer, p_bps integer)
returns integer language sql immutable set search_path = '' as $$
  select ((p_amount::bigint * p_bps + 5000) / 10000)::integer
$$;

-- Transitions d'état autorisées (un état final ne se rouvre pas, sauf remboursement).
create or replace function public.cabin_transition_allowed(p_from public.cabin_status, p_to public.cabin_status)
returns boolean language sql immutable set search_path = '' as $$
  select case p_from
    when 'created' then p_to in ('pending', 'processing', 'failed', 'cancelled', 'expired')
    when 'pending' then p_to in ('processing', 'awaiting_confirmation', 'succeeded', 'failed', 'cancelled', 'expired')
    when 'processing' then p_to in ('awaiting_confirmation', 'succeeded', 'failed')
    when 'awaiting_confirmation' then p_to in ('succeeded', 'failed', 'refunded')
    when 'succeeded' then p_to = 'refunded'
    when 'failed' then p_to = 'refunded'
    else false
  end
$$;

-- Création d'une opération (serveur de la plateforme uniquement, après devis signé).
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
          case when v_mode = 'live' then 'pending' else 'cancelled' end,
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
revoke execute on function public.create_cabin_operation(uuid, text, uuid, public.cabin_service, text, text, uuid, text, text, integer, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.create_cabin_operation(uuid, text, uuid, public.cabin_service, text, text, uuid, text, text, integer, integer, timestamptz, boolean) to service_role;

-- Changement d'état : prestataire (notification vérifiée, par le serveur) ou rapprochement par un administrateur.
create or replace function public.set_cabin_status(
  p_operation uuid,
  p_status public.cabin_status,
  p_source text,
  p_detail text,
  p_provider_reference text default null,
  p_delivery_code text default null
)
returns public.cabin_status
language plpgsql security definer set search_path = '' as $$
declare
  v_op public.cabin_operations;
  v_actor uuid := (select auth.uid());
begin
  if p_source = 'administration' then
    if not public.is_admin() then
      raise exception 'Réservé aux administrateurs.' using errcode = '42501';
    end if;
    if char_length(btrim(coalesce(p_detail, ''))) < 5 then
      raise exception 'Indiquez la raison du rapprochement (5 caractères au moins).' using errcode = '23514';
    end if;
  elsif p_source in ('prestataire', 'systeme', 'serveur') then
    if not public.is_service_request() then
      raise exception 'Réservé au serveur de la plateforme.' using errcode = '42501';
    end if;
  else
    raise exception 'Origine inconnue.' using errcode = '22023';
  end if;

  select * into v_op from public.cabin_operations o where o.id = p_operation for update;
  if v_op.id is null then
    raise exception 'Opération introuvable.' using errcode = 'P0002';
  end if;
  if v_op.status = p_status then
    return v_op.status; -- notification répétée : aucun effet
  end if;
  if not public.cabin_transition_allowed(v_op.status, p_status) then
    raise exception 'Passage de « % » à « % » impossible.', v_op.status, p_status using errcode = '23514';
  end if;
  if p_status = 'succeeded' and (v_op.mode <> 'live' or coalesce(p_provider_reference, v_op.provider_reference) is null) then
    raise exception 'Une réussite exige une confirmation du prestataire (mode réel, référence).' using errcode = '23514';
  end if;

  update public.cabin_operations
  set status = p_status,
      status_reason = left(btrim(p_detail), 500),
      provider_reference = coalesce(p_provider_reference, provider_reference),
      delivery_code = coalesce(p_delivery_code, delivery_code),
      completed_at = case when p_status in ('succeeded', 'failed', 'cancelled', 'expired', 'refunded') then now() else completed_at end
  where id = p_operation;
  insert into public.cabin_operation_events (operation_id, from_status, to_status, source, detail, actor_id)
  values (p_operation, v_op.status, p_status, p_source, left(btrim(p_detail), 500), case when p_source = 'administration' then v_actor end);
  if p_source = 'administration' then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    values (v_actor, 'cabine.rapprochement', 'cabin_operations', p_operation,
            jsonb_build_object('reference', v_op.reference, 'avant', v_op.status, 'apres', p_status, 'raison', btrim(p_detail)));
  end if;
  return p_status;
end;
$$;
revoke execute on function public.set_cabin_status(uuid, public.cabin_status, text, text, text, text) from public, anon;
grant execute on function public.set_cabin_status(uuid, public.cabin_status, text, text, text, text) to authenticated, service_role;

-- Suivi par le visiteur (jeton de suivi) : état et montants, jamais le numéro en clair.
create or replace function public.cabin_operation_status(p_reference text, p_token_hash text)
returns table (reference text, service public.cabin_service, status public.cabin_status, status_reason text, mode public.cabin_mode,
               recipient_masked text, amount_xof integer, service_fee_xof integer, provider_fee_xof integer, total_xof integer,
               delivery_code text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.reference, o.service, o.status, o.status_reason, o.mode, o.recipient_masked, o.amount_xof, o.service_fee_xof,
         o.provider_fee_xof, o.total_xof, case when o.status = 'succeeded' then o.delivery_code end, o.created_at, o.updated_at
  from public.cabin_operations o
  where public.is_service_request() and o.reference = p_reference and o.follow_token_hash = p_token_hash
$$;
revoke execute on function public.cabin_operation_status(text, text) from public, anon, authenticated;
grant execute on function public.cabin_operation_status(text, text) to service_role;

-- Opérations jamais confirmées : expirées au bout d'une heure (sans relance automatique).
create or replace function public.expire_cabin_operations()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_op record; n integer := 0;
begin
  for v_op in select id, status from public.cabin_operations where status in ('created', 'pending') and created_at < now() - interval '1 hour' loop
    update public.cabin_operations set status = 'expired', status_reason = 'Aucune confirmation du prestataire dans le délai.', completed_at = now() where id = v_op.id;
    insert into public.cabin_operation_events (operation_id, from_status, to_status, source, detail)
    values (v_op.id, v_op.status, 'expired', 'systeme', 'Expiration automatique : rien n’est relancé.');
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expire_cabin_operations() from public, anon, authenticated;
select cron.schedule('expirer-operations-cabine', '*/10 * * * *', $$select public.expire_cabin_operations()$$);

-- Référentiel initial --------------------------------------------------------
insert into public.cabin_networks (code, name, kind, sort_order) values
  ('orange', 'Orange', 'telecom', 10),
  ('mtn', 'MTN', 'telecom', 20),
  ('moov', 'Moov Africa', 'telecom', 30),
  ('wave', 'Wave', 'mobile_money', 10),
  ('orange_money', 'Orange Money', 'mobile_money', 20),
  ('moov_money', 'Moov Money', 'mobile_money', 30),
  ('mtn_momo', 'MTN MoMo', 'mobile_money', 40),
  ('cie', 'CIE (électricité prépayée)', 'utility', 10);

insert into public.cabin_service_settings (service, label, description, min_amount_xof, max_amount_xof) values
  ('airtime', 'Crédit téléphonique', 'Recharger un numéro Orange, MTN ou Moov.', 100, 100000),
  ('airtime_transfer', 'Transfert d’unités', 'Transférer des unités vers un autre numéro, si l’opérateur le permet.', 100, 50000),
  ('data', 'Offres Internet', 'Acheter un forfait Internet du catalogue de l’opérateur.', 100, 100000),
  ('electricity', 'Recharge compteur CIE', 'Recharger un compteur prépayé CIE et recevoir le code de recharge.', 1000, 500000),
  ('money_transfer', 'Transfert entre réseaux', 'Envoyer de l’argent entre Wave, Orange Money, Moov Money et MTN MoMo.', 100, 1500000);

-- Toutes les combinaisons entre les quatre portefeuilles, désactivées : aucune n'est prise en charge sans prestataire.
insert into public.cabin_transfer_routes (source_code, target_code, note)
select s.code, t.code, 'Aucun prestataire connecté ne prend en charge cette combinaison.'
from public.cabin_networks s cross join public.cabin_networks t
where s.kind = 'mobile_money' and t.kind = 'mobile_money' and s.code <> t.code;
