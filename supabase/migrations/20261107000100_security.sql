-- =============================================================================
-- Niveau 26 : sécurité et anti-fraude.
--
-- - blocage d'un membre : il ne peut plus écrire à celui qui l'a bloqué ;
-- - recours : contester une suspension de contenu ou de compte, décision
--   humaine journalisée, réponse notifiée ;
-- - signaux de fraude (photo reprise, prix anormal, liens et coordonnées
--   suspects, rafale de publications, paiement d'avance, signalements) :
--   un score d'AIDE À LA REVUE, jamais une sanction ; alerte de l'équipe pour
--   une annonce à risque soumise ;
-- - charte de confiance : acceptation datée par l'annonceur et le visiteur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Blocage
-- -----------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy user_blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create or replace function public.enforce_message_blocks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.conversation_participants cp
    join public.user_blocks b on b.blocker_id = cp.user_id and b.blocked_id = new.sender_id
    where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id
  ) then
    raise exception 'Ce membre ne reçoit plus vos messages.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger messages_blocks before insert on public.messages
  for each row execute function public.enforce_message_blocks();

-- -----------------------------------------------------------------------------
-- Recours
-- -----------------------------------------------------------------------------
create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'place', 'event', 'business', 'comment', 'review', 'account')),
  target_id uuid not null,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index appeals_one_pending on public.appeals (target_type, target_id) where status = 'pending';
alter table public.appeals enable row level security;
create policy appeals_select on public.appeals for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
revoke insert, update, delete on public.appeals from anon, authenticated;
create trigger appeals_revisions after insert or update on public.appeals
  for each row execute function public.record_revision();

-- Propriétaire du contenu visé et état « contestable » (refusé ou masqué, compte suspendu).
create or replace function public.appeal_target_state(p_type text, p_id uuid)
returns table (owner_id uuid, contestable boolean, title text)
language sql stable security definer set search_path = '' as $$
  select l.owner_id, l.status = 'rejected', l.title from public.listings l where p_type = 'listing' and l.id = p_id
  union all
  select coalesce(p.manager_id, p.created_by), p.status = 'rejected', p.name from public.places p where p_type = 'place' and p.id = p_id
  union all
  select e.organizer_id, e.status = 'rejected', e.title from public.events e where p_type = 'event' and e.id = p_id
  union all
  select b.owner_id, b.status = 'rejected', b.name from public.business_profiles b where p_type = 'business' and b.id = p_id
  union all
  select c.author_id, c.status = 'hidden', left(c.body, 80) from public.listing_comments c where p_type = 'comment' and c.id = p_id
  union all
  select r.author_id, r.status = 'hidden', left(coalesce(r.body, 'Avis'), 80) from public.reviews r where p_type = 'review' and r.id = p_id
  union all
  select pr.id, pr.is_suspended, coalesce(pr.display_name, 'Compte') from public.profiles pr where p_type = 'account' and pr.id = p_id
$$;
revoke execute on function public.appeal_target_state(text, uuid) from public, anon, authenticated;

create or replace function public.submit_appeal(p_type text, p_id uuid, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_state record;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select * into v_state from public.appeal_target_state(p_type, p_id);
  if v_state.owner_id is distinct from v_uid then
    raise exception 'Contenu introuvable.' using errcode = 'P0002';
  end if;
  if not v_state.contestable then
    raise exception 'Ce contenu n’est ni refusé ni suspendu : rien à contester.' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) < 10 then
    raise exception 'Expliquez votre recours (10 caractères au moins).' using errcode = '23514';
  end if;
  if (select count(*) from public.appeals where user_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de recours en peu de temps. Réessayez demain.' using errcode = 'CP429';
  end if;
  insert into public.appeals (user_id, target_type, target_id, message) values (v_uid, p_type, p_id, btrim(p_message)) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Un recours est déjà en cours d’examen pour ce contenu.' using errcode = '23505';
end;
$$;
revoke execute on function public.submit_appeal(text, uuid, text) from public, anon;

-- Décision humaine : accepté = le contenu repart en relecture (ou redevient visible,
-- ou le compte est réactivé par un administrateur) ; refusé = motif transmis.
create or replace function public.decide_appeal(p_appeal uuid, p_accept boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_appeal public.appeals;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe de modération.' using errcode = '42501';
  end if;
  if char_length(coalesce(v_note, '')) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  select * into v_appeal from public.appeals where id = p_appeal for update;
  if v_appeal.id is null or v_appeal.status <> 'pending' then
    raise exception 'Recours introuvable ou déjà tranché.' using errcode = 'P0002';
  end if;
  if p_accept and v_appeal.target_type = 'account' and not public.is_admin() then
    raise exception 'Seul un administrateur réactive un compte.' using errcode = '42501';
  end if;
  perform set_config('app.change_reason', 'Recours : ' || v_note, true);

  if p_accept then
    case v_appeal.target_type
      when 'listing' then update public.listings set status = 'pending', rejection_reason = null where id = v_appeal.target_id and status = 'rejected';
      when 'place' then update public.places set status = 'pending', rejection_reason = null where id = v_appeal.target_id and status = 'rejected';
      when 'event' then update public.events set status = 'pending', rejection_reason = null where id = v_appeal.target_id and status = 'rejected';
      when 'business' then update public.business_profiles set status = 'pending', rejection_reason = null where id = v_appeal.target_id and status = 'rejected';
      when 'comment' then update public.listing_comments set status = 'visible', hidden_reason = null where id = v_appeal.target_id and status = 'hidden';
      when 'review' then update public.reviews set status = 'published' where id = v_appeal.target_id and status = 'hidden';
      when 'account' then update public.profiles set is_suspended = false where id = v_appeal.target_id;
    end case;
  end if;

  update public.appeals set status = case when p_accept then 'accepted' else 'rejected' end,
    decision_note = v_note, decided_by = (select auth.uid()), decided_at = now()
  where id = p_appeal;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_appeal.user_id, 'moderation',
          case when p_accept then 'Recours accepté' else 'Recours refusé' end,
          case when p_accept
            then 'Votre contenu est de nouveau examiné ou rétabli. ' || v_note
            else 'Motif : ' || v_note end,
          '/tableau-de-bord/activite');
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_accept then 'recours.accepte' else 'recours.refuse' end, 'appeals', p_appeal,
          jsonb_build_object('contenu', v_appeal.target_type, 'cible', v_appeal.target_id, 'raison', v_note, 'avant', 'pending', 'apres', case when p_accept then 'accepted' else 'rejected' end));
end;
$$;
revoke execute on function public.decide_appeal(uuid, boolean, text) from public, anon;

create or replace function public.admin_appeals(p_pending boolean default true)
returns table (id uuid, target_type text, target_id uuid, title text, message text, status text, decision_note text, created_at timestamptz, decided_at timestamptz, author_name text, user_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe de modération.' using errcode = '42501';
  end if;
  return query
  select a.id, a.target_type, a.target_id, coalesce((select s.title from public.appeal_target_state(a.target_type, a.target_id) s), '(contenu supprimé)'),
         a.message, a.status, a.decision_note, a.created_at, a.decided_at, p.display_name, a.user_id
  from public.appeals a left join public.profiles p on p.id = a.user_id
  where (p_pending and a.status = 'pending') or (not p_pending and a.status <> 'pending')
  order by a.created_at
  limit 100;
end;
$$;
revoke execute on function public.admin_appeals(boolean) from public, anon;

-- -----------------------------------------------------------------------------
-- Signaux de fraude (aide à la revue humaine)
-- -----------------------------------------------------------------------------
-- Calcul interne (sans contrôle de rôle) : appelé par les fonctions de l'équipe et par l'alerte.
create or replace function public.fraud_signals_for(p_listing uuid)
returns table (code text, label text, weight integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_listing public.listings;
  v_text text;
  v_median numeric;
  v_samples integer;
  v_digits text;
begin
  select * into v_listing from public.listings where id = p_listing;
  if v_listing.id is null then
    return;
  end if;
  v_text := lower(public.immutable_unaccent(coalesce(v_listing.title, '') || ' ' || coalesce(v_listing.description, '')));

  if exists (
    select 1 from public.images i join public.images o on o.content_hash = i.content_hash and o.id <> i.id and o.owner_id <> i.owner_id
    where i.listing_id = p_listing and i.content_hash is not null
  ) then
    return query select 'photo_reprise'::text, 'Photo identique à celle d’une annonce d’un autre compte'::text, 3;
  end if;

  if v_listing.price is not null and v_listing.price > 0 then
    select percentile_cont(0.5) within group (order by l.price), count(*) into v_median, v_samples
    from public.listings l
    where l.category_id = v_listing.category_id and l.id <> p_listing and l.status = 'published' and l.price > 0
      and l.price_unit is not distinct from v_listing.price_unit;
    if v_samples >= 5 and v_listing.price < v_median * 0.25 then
      return query select 'prix_bas'::text, 'Prix inférieur au quart du prix médian de la catégorie'::text, 2;
    elsif v_samples >= 5 and v_listing.price > v_median * 5 then
      return query select 'prix_haut'::text, 'Prix supérieur à cinq fois le prix médian de la catégorie'::text, 1;
    end if;
  end if;

  if v_text ~ '(bit\.ly|tinyurl|goo\.gl|t\.co/|t\.me/|wa\.me/|is\.gd|cutt\.ly|shorturl)' then
    return query select 'lien_raccourci'::text, 'Lien raccourci ou messagerie externe dans le texte'::text, 2;
  elsif v_text ~ 'https?://' then
    return query select 'lien_externe'::text, 'Lien externe dans le texte'::text, 1;
  end if;

  if v_text ~ '(acompte|avance|frais de dossier|western union|moneygram|mandat cash|transfert d.argent|paiement avant visite|reservation payante)' then
    return query select 'paiement_avance'::text, 'Demande de paiement d’avance ou de transfert'::text, 3;
  end if;

  v_digits := right(regexp_replace(coalesce(v_listing.contact_phone, v_listing.contact_whatsapp, ''), '\D', '', 'g'), 8);
  if char_length(v_digits) = 8 and (
    select count(distinct l.owner_id) from public.listings l
    where l.owner_id <> v_listing.owner_id
      and right(regexp_replace(coalesce(l.contact_phone, l.contact_whatsapp, ''), '\D', '', 'g'), 8) = v_digits
  ) >= 2 then
    return query select 'numero_partage'::text, 'Même numéro utilisé par plusieurs autres comptes'::text, 3;
  end if;

  if exists (select 1 from public.profiles p where p.id = v_listing.owner_id and p.created_at > now() - interval '7 days')
     and (select count(*) from public.listings l where l.owner_id = v_listing.owner_id and l.created_at > now() - interval '1 day') >= 3 then
    return query select 'rafale'::text, 'Compte récent : 3 annonces ou plus en 24 heures'::text, 2;
  end if;

  if (select count(*) from public.reports r join public.listings l on l.id = r.listing_id
      where l.owner_id = v_listing.owner_id and r.status in ('open', 'reviewing')) >= 2 then
    return query select 'signalements'::text, 'Plusieurs signalements ouverts sur les annonces du compte'::text, 2;
  end if;
end;
$$;
revoke execute on function public.fraud_signals_for(uuid) from public, anon, authenticated;

-- Signaux d'une annonce, pour l'équipe de modération seulement.
create or replace function public.listing_fraud_signals(p_listing uuid)
returns table (code text, label text, weight integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_staff() or public.is_service_request()) then
    return;
  end if;
  return query select * from public.fraud_signals_for(p_listing);
end;
$$;
revoke execute on function public.listing_fraud_signals(uuid) from public, anon;

-- Annonces en attente ou publiées dont le score atteint 3 : file de revue.
create or replace function public.fraud_review_queue()
returns table (listing_id uuid, slug text, title text, status text, owner_id uuid, created_at timestamptz, score integer, signals jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe de modération.' using errcode = '42501';
  end if;
  return query
  select l.id, l.slug, l.title, l.status::text, l.owner_id, l.created_at, s.score::integer, s.signals
  from public.listings l
  cross join lateral (
    select coalesce(sum(f.weight), 0) as score, coalesce(jsonb_agg(jsonb_build_object('code', f.code, 'label', f.label, 'weight', f.weight)), '[]'::jsonb) as signals
    from public.fraud_signals_for(l.id) f
  ) s
  where l.status in ('pending', 'published') and l.updated_at > now() - interval '60 days' and s.score >= 3
  order by s.score desc, l.created_at desc
  limit 50;
end;
$$;
revoke execute on function public.fraud_review_queue() from public, anon;

-- Alerte de l'équipe : une annonce soumise atteint un score élevé (5 ou plus).
create or replace function public.alert_risky_listing()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_score integer;
begin
  if new.status = 'pending' and old.status is distinct from 'pending' then
    select coalesce(sum(weight), 0) into v_score from public.fraud_signals_for(new.id);
    if v_score >= 5 then
      insert into public.notifications (user_id, type, title, body, link, dedupe_key)
      select p.id, 'securite', 'Annonce à risque en attente : ' || left(new.title, 80),
             'Score anti-fraude ' || v_score || ' : à examiner avant publication (aide à la décision, aucune sanction automatique).',
             '/admin/fraude', 'fraude:' || new.id || ':' || to_char(now(), 'YYYY-MM-DD')
      from public.profiles p where p.role in ('moderator', 'admin', 'superadmin') and not p.is_suspended
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
create trigger listings_fraud_alert after update of status on public.listings
  for each row execute function public.alert_risky_listing();

-- -----------------------------------------------------------------------------
-- Charte de confiance
-- -----------------------------------------------------------------------------
create table public.charter_acceptances (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role text not null check (role in ('annonceur', 'visiteur')),
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, role, version)
);
alter table public.charter_acceptances enable row level security;
create policy charter_acceptances_own_read on public.charter_acceptances for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy charter_acceptances_own_insert on public.charter_acceptances for insert to authenticated
  with check (user_id = (select auth.uid()) and accepted_at > now() - interval '1 minute');
