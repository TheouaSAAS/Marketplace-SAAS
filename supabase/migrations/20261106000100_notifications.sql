-- =============================================================================
-- Niveau 24 : notifications et réengagement.
--
-- - idempotence : clé de dédoublonnage par personne (une alerte, un rappel ou
--   une relance n'est créé qu'une fois) ;
-- - file d'envoi par canal (`notification_deliveries`) alimentée par la base à
--   chaque notification, selon les préférences ; un envoi par notification et
--   par canal ; essais limités avec attente croissante, erreurs journalisées ;
-- - nouvelles notifications : messages reçus (une seule non lue par
--   conversation), demandes de contact et de devis, annonces qui expirent
--   bientôt ou ont expiré (avec confirmation en un clic) ;
-- - formulations prudentes pour les contenus non vérifiés.
-- =============================================================================

alter table public.notifications add column dedupe_key text check (dedupe_key is null or char_length(dedupe_key) <= 200);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- Catégorie de préférence de chaque type de notification.
create or replace function public.notification_category(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_type in ('annonce', 'page_pro', 'moderation', 'revendication', 'verification') then 'decisions'
    else p_type
  end
$$;

-- Coupure sur le site : catégories non essentielles seulement (les décisions restent affichées).
create or replace function public.filter_muted_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.notification_category(new.type) <> 'decisions'
     and exists (
       select 1 from public.user_preferences u
       where u.user_id = new.user_id and (u.notification_channels -> public.notification_category(new.type) ->> 'site') = 'false'
     ) then
    return null;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- File d'envoi
-- -----------------------------------------------------------------------------
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'simulated', 'skipped', 'failed')),
  attempts integer not null default 0,
  -- Code d'erreur court, jamais le contenu ni l'adresse.
  last_error text check (last_error is null or char_length(last_error) <= 200),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_due_idx on public.notification_deliveries (next_attempt_at) where status = 'pending';
alter table public.notification_deliveries enable row level security;
create policy notification_deliveries_admin_read on public.notification_deliveries for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.notification_deliveries from anon, authenticated;

-- Une notification enregistrée part par e-mail si la personne ne l'a pas coupé
-- (catégorie ou tous les e-mails) et si son adresse est confirmée.
create or replace function public.enqueue_notification_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_channels jsonb;
begin
  select notification_channels into v_channels from public.user_preferences where user_id = new.user_id;
  if coalesce(v_channels -> '_email' ->> 'off', 'false') = 'true'
     or coalesce(v_channels -> public.notification_category(new.type) ->> 'email', 'true') = 'false' then
    return new;
  end if;
  if not exists (select 1 from auth.users u where u.id = new.user_id and u.email is not null and u.email_confirmed_at is not null) then
    return new;
  end if;
  insert into public.notification_deliveries (notification_id, user_id, channel) values (new.id, new.user_id, 'email')
  on conflict do nothing;
  return new;
end;
$$;
create trigger notifications_enqueue after insert on public.notifications
  for each row execute function public.enqueue_notification_delivery();

-- Réserve des envois à traiter (rôle de service) ; un envoi en cours depuis
-- plus de 10 minutes est repris (processus interrompu).
create or replace function public.claim_notification_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid, channel text, attempts integer, user_id uuid, email text, display_name text,
  notification_id uuid, type text, title text, body text, link text, created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  update public.notification_deliveries set status = 'pending'
  where status = 'sending' and next_attempt_at < now() - interval '10 minutes';
  return query
  with picked as (
    select d.id from public.notification_deliveries d
    where d.status = 'pending' and d.next_attempt_at <= now()
    order by d.next_attempt_at
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    for update skip locked
  ),
  marked as (
    update public.notification_deliveries d
    set status = 'sending', attempts = d.attempts + 1, next_attempt_at = now()
    from picked where d.id = picked.id
    returning d.*
  )
  select m.id, m.channel, m.attempts, m.user_id, u.email::text, p.display_name, n.id, n.type, n.title, n.body, n.link, n.created_at
  from marked m
  join public.notifications n on n.id = m.notification_id
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id;
end;
$$;
revoke execute on function public.claim_notification_deliveries(integer) from public, anon, authenticated;

-- Résultat d'un envoi. Échec : nouvel essai après 2, 4, 8, 16 minutes, puis abandon.
create or replace function public.complete_notification_delivery(p_delivery uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent', 'simulated', 'skipped', 'failed') then
    raise exception 'Statut d''envoi inconnu.' using errcode = '22023';
  end if;
  update public.notification_deliveries d
  set status = case when p_status = 'failed' and d.attempts < 5 then 'pending' else p_status end,
      last_error = left(p_error, 200),
      sent_at = case when p_status in ('sent', 'simulated') then now() end,
      next_attempt_at = case when p_status = 'failed' then now() + make_interval(mins => power(2, d.attempts)::integer) else d.next_attempt_at end
  where d.id = p_delivery and d.status = 'sending';
end;
$$;
revoke execute on function public.complete_notification_delivery(uuid, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nouvelles notifications
-- -----------------------------------------------------------------------------
-- Message reçu : une seule notification non lue par conversation (pas de rafale).
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sender text;
begin
  select coalesce(display_name, 'Un membre') into v_sender from public.profiles where id = new.sender_id;
  insert into public.notifications (user_id, type, title, body, link)
  select cp.user_id, 'message', 'Nouveau message de ' || coalesce(v_sender, 'un membre'), null, '/messages/' || new.conversation_id
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id and not cp.is_archived
    and not exists (
      select 1 from public.notifications n
      where n.user_id = cp.user_id and n.type = 'message' and n.read_at is null and n.link = '/messages/' || new.conversation_id
    );
  return new;
end;
$$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_new_message();

-- Demande de contact ou de devis reçue (le contenu reste dans la boîte de réception).
create or replace function public.notify_contact_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (new.recipient_id, 'demande',
          case when new.kind = 'devis' then 'Nouvelle demande de devis' else 'Nouvelle demande de contact' end,
          'De ' || left(new.sender_name, 80) || '. Répondez depuis vos demandes reçues.',
          case when new.business_id is not null then '/espace-pro/' || new.business_id || '/demandes' else '/devis' end);
  return new;
end;
$$;
create trigger contact_requests_notify after insert on public.contact_requests
  for each row execute function public.notify_contact_request();

-- Annonces qui expirent dans les 3 jours, ou qui viennent d'expirer : une seule relance par échéance.
create or replace function public.notify_expiring_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n1 integer;
  n2 integer;
begin
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  select l.owner_id, 'expiration', 'Votre annonce expire bientôt : ' || left(l.title, 80),
         'Fin de diffusion le ' || to_char(l.expires_at at time zone 'Africa/Abidjan', 'DD/MM') || '. Toujours disponible ? Confirmez-la pour la prolonger.',
         '/tableau-de-bord/annonces', 'expiration:' || l.id || ':' || to_char(l.expires_at, 'YYYY-MM-DD')
  from public.listings l
  where l.status = 'published' and l.expires_at > now() and l.expires_at <= now() + interval '3 days'
  on conflict do nothing;
  get diagnostics n1 = row_count;
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  select l.owner_id, 'expiration', 'Annonce expirée : ' || left(l.title, 80),
         'Elle n’est plus visible. Vous pouvez la soumettre de nouveau depuis vos annonces.',
         '/tableau-de-bord/annonces', 'expiree:' || l.id || ':' || to_char(l.expires_at, 'YYYY-MM-DD')
  from public.listings l
  where l.status = 'expired' and l.expires_at > now() - interval '2 days'
  on conflict do nothing;
  get diagnostics n2 = row_count;
  return n1 + n2;
end;
$$;
revoke execute on function public.notify_expiring_listings() from public, anon, authenticated;
select cron.schedule('relancer-annonces-expirant', '40 8 * * *', 'select public.notify_expiring_listings()');

-- Confirmation par l'auteur : l'annonce reste publiée et sa diffusion repart pour la durée par défaut.
create or replace function public.confirm_listing(p_listing uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_listing public.listings;
  v_days integer;
  v_until timestamptz;
begin
  select * into v_listing from public.listings where id = p_listing;
  if v_listing.id is null or not public.can_manage_content(v_listing.owner_id, v_listing.organization_id) then
    raise exception 'Annonce introuvable.' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'published' or v_listing.expires_at is null or v_listing.expires_at > now() + interval '7 days' then
    raise exception 'Cette annonce se confirme dans les 7 jours qui précèdent sa fin de diffusion.' using errcode = '23514';
  end if;
  if public.is_suspended() then
    raise exception 'Compte suspendu.' using errcode = '42501';
  end if;
  select coalesce((value ->> 'days')::integer, 60) into v_days from public.platform_settings where key = 'listings.default_duration';
  v_until := now() + make_interval(days => coalesce(v_days, 60));
  update public.listings set expires_at = v_until, last_confirmed_at = now() where id = p_listing;
  return v_until;
end;
$$;
revoke execute on function public.confirm_listing(uuid) from public, anon;

-- Rappels d'événements : prudence quand l'événement n'est pas vérifié.
create or replace function public.send_event_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  with due as (
    insert into public.event_reminders (event_id, user_id)
    select e.id, f.user_id
    from public.events e
    join public.favorites f on f.event_id = e.id
    where e.status = 'published' and e.schedule_status <> 'cancelled'
      and e.starts_at > now() and e.starts_at <= now() + interval '24 hours'
    on conflict do nothing
    returning event_id, user_id
  )
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  select d.user_id, 'rappel', 'Rappel : ' || e.title,
         case when e.verification_status = 'verified'
           then 'Commence le ' || to_char(e.starts_at at time zone 'Africa/Abidjan', 'DD/MM à HH24"h"MI') || '.'
           else 'Annoncé pour le ' || to_char(e.starts_at at time zone 'Africa/Abidjan', 'DD/MM à HH24"h"MI')
                || ' selon l’organisateur (non vérifié par l’équipe) : confirmez avant de vous déplacer.'
         end,
         '/evenements/' || e.slug, 'rappel:' || e.id
  from due d join public.events e on e.id = d.event_id
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Alertes de recherches enregistrées : calculées par le serveur (même moteur que
-- la recherche), qui crée la notification puis marque la recherche.
create or replace function public.record_search_alert(p_search uuid, p_new integer, p_title text, p_link text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_search public.saved_searches;
begin
  select * into v_search from public.saved_searches where id = p_search for update;
  if v_search.id is null then
    return false;
  end if;
  update public.saved_searches set last_alerted_at = now() where id = p_search;
  if coalesce(p_new, 0) <= 0 then
    return false;
  end if;
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  values (v_search.user_id, 'recherche', left(p_title, 120),
          'Contenus publiés par leurs auteurs : vérifiez les informations avant de vous engager.',
          p_link, 'recherche:' || p_search || ':' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY-MM-DD'))
  on conflict do nothing;
  return found;
end;
$$;
revoke execute on function public.record_search_alert(uuid, integer, text, text) from public, anon, authenticated;
