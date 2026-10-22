-- =============================================================================
-- Niveau 16 : événements.
-- - Catégories : culture, sport, formation, professionnel, tourisme, communauté,
--   autres (sous-catégories administrables d'« Événements »).
-- - Recherche ordonnée dans le temps ; un événement terminé n'est jamais « à venir ».
-- - Report et annulation par l'organisateur : l'événement RESTE visible avec son
--   nouveau statut (pas de retour en modération), motif obligatoire, personnes
--   qui l'ont en favori prévenues.
-- - Archivage automatique, rappels la veille, messagerie avec l'organisateur,
--   décision de modération notifiée à l'organisateur.
-- =============================================================================

insert into public.categories (parent_id, family, slug, name, content_types, sort_order, keywords)
select parent.id, parent.family, v.slug, v.name, '{event}'::public.content_type[], v.sort_order, v.keywords::text[]
from (values
  ('ateliers-formations', 'Formation et ateliers', 50, '{atelier,formation,cours,masterclass,initiation}'),
  ('communaute-solidarite', 'Communauté et solidarité', 60, '{association,benevolat,solidarite,quartier,collecte,reunion}'),
  ('sorties-tourisme', 'Tourisme et sorties', 70, '{excursion,visite,balade,decouverte,plage}'),
  ('autres-evenements', 'Autres événements', 90, '{}')
) as v(slug, name, sort_order, keywords)
cross join public.categories parent
where parent.slug = 'evenements'
on conflict (slug) do nothing;

update public.categories c set keywords = v.keywords::text[]
from (values
  ('concerts-spectacles', '{concert,spectacle,festival,theatre,humour,danse}'),
  ('sport', '{match,tournoi,course,marathon,football,sport}'),
  ('culture-traditions', '{culture,tradition,exposition,fete,ceremonie}'),
  ('salons-conferences', '{salon,conference,forum,seminaire,professionnel,networking}')
) as v(slug, keywords)
where c.slug = v.slug and c.keywords = '{}';

-- -----------------------------------------------------------------------------
-- Recherche dans le temps (droits de l'appelant)
-- -----------------------------------------------------------------------------
create or replace function public.search_events(
  p_city uuid,
  p_categories uuid[] default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_free boolean default null,
  p_neighborhood uuid default null,
  p_query text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (id uuid, total_count bigint)
language sql stable security invoker set search_path = '' as $$
  select e.id, count(*) over ()
  from public.events e
  where e.city_id = p_city
    and e.status = 'published'
    and public.verification_publicly_visible(e.verification_status)
    -- Jamais un événement terminé : fin (ou début) après maintenant ET après le début de la période.
    and coalesce(e.ends_at, e.starts_at) >= greatest(now(), coalesce(p_from, now()))
    and (p_to is null or e.starts_at < p_to)
    and (p_categories is null or e.category_id = any (p_categories))
    and (p_free is null or e.is_free = p_free)
    and (p_neighborhood is null or e.neighborhood_id = p_neighborhood)
    and (public.search_normalize(p_query) = '' or e.search_vector @@ public.search_tsquery(p_query)
         or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(e.title))
  order by e.starts_at, e.id
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.search_events(uuid, uuid[], timestamptz, timestamptz, boolean, uuid, text, integer, integer) from public;
grant execute on function public.search_events(uuid, uuid[], timestamptz, timestamptz, boolean, uuid, text, integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Report et annulation par l'organisateur (ou l'équipe)
-- -----------------------------------------------------------------------------
create or replace function public.change_event_schedule(
  p_event uuid,
  p_action text,
  p_note text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_title text;
begin
  select * into v_event from public.events where id = p_event for update;
  if v_event.id is null
     or not (public.can_manage_content(v_event.organizer_id, v_event.organization_id) or public.is_staff()) then
    raise exception 'Seul l''organisateur ou l''équipe modifie le programme de cet événement.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Expliquez le changement (5 caractères au moins) : il est affiché au public.' using errcode = '23514';
  end if;
  if coalesce(v_event.ends_at, v_event.starts_at) < now() then
    raise exception 'Cet événement est terminé.' using errcode = '23514';
  end if;
  if p_action = 'reporter' then
    if p_starts_at is null or p_starts_at <= now() then
      raise exception 'Indiquez une nouvelle date à venir.' using errcode = '23514';
    end if;
    if p_ends_at is not null and p_ends_at < p_starts_at then
      raise exception 'La fin doit suivre le début.' using errcode = '23514';
    end if;
    -- Contexte du propriétaire de la fonction : pas de retour en modération (règle voulue,
    -- un report doit rester visible) ; track_event_schedule conserve la date initiale.
    update public.events
    set starts_at = p_starts_at, ends_at = p_ends_at, schedule_status = 'postponed', schedule_note = btrim(p_note)
    where id = p_event;
    v_title := 'Événement reporté : ' || v_event.title;
  elsif p_action = 'annuler' then
    update public.events set schedule_status = 'cancelled', schedule_note = btrim(p_note) where id = p_event;
    v_title := 'Événement annulé : ' || v_event.title;
  else
    raise exception 'Action inconnue.' using errcode = '22023';
  end if;

  -- Personnes qui l'ont en favori (sauf l'organisateur).
  insert into public.notifications (user_id, type, title, body, link)
  select f.user_id, 'evenement', v_title, btrim(p_note), '/evenements/' || v_event.slug
  from public.favorites f
  where f.event_id = p_event and f.user_id <> v_event.organizer_id;
end;
$$;
revoke execute on function public.change_event_schedule(uuid, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.change_event_schedule(uuid, text, text, timestamptz, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- Décision de modération notifiée à l'organisateur
-- -----------------------------------------------------------------------------
create or replace function public.notify_event_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' and new.status in ('published', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.organizer_id, 'evenement',
            case when new.status = 'published' then 'Événement publié : ' else 'Événement refusé : ' end || new.title,
            case when new.status = 'rejected' then new.rejection_reason end,
            '/evenements/' || new.slug);
  end if;
  return new;
end;
$$;
create trigger events_notify_moderation after update of status on public.events
  for each row execute function public.notify_event_moderation();

-- -----------------------------------------------------------------------------
-- Archivage automatique et rappels
-- -----------------------------------------------------------------------------
-- Terminé depuis 30 jours : archivé (la fiche dit « terminé » d'ici là).
create or replace function public.archive_past_events()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  update public.events set status = 'archived'
  where status = 'published' and coalesce(ends_at, starts_at) < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.archive_past_events() from public, anon, authenticated;

create table public.event_reminders (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_reminders enable row level security;
create policy event_reminders_own on public.event_reminders for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.event_reminders from anon, authenticated;

-- Rappel unique, dans les 24 heures précédant le début, pour les événements en favori.
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
  insert into public.notifications (user_id, type, title, body, link)
  select d.user_id, 'rappel', 'Rappel : ' || e.title,
         'Commence le ' || to_char(e.starts_at at time zone 'Africa/Abidjan', 'DD/MM à HH24"h"MI') || '.',
         '/evenements/' || e.slug
  from due d join public.events e on e.id = d.event_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.send_event_reminders() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('archiver-evenements', 'rappels-evenements');
select cron.schedule('archiver-evenements', '10 * * * *', 'select public.archive_past_events()');
select cron.schedule('rappels-evenements', '*/15 * * * *', 'select public.send_event_reminders()');

-- -----------------------------------------------------------------------------
-- Messagerie avec l'organisateur
-- -----------------------------------------------------------------------------
create or replace function public.start_event_conversation(p_event uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_organizer uuid;
  v_conversation uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour écrire à l''organisateur.' using errcode = '42501';
  end if;
  if public.is_suspended() then
    raise exception 'Compte suspendu.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'Message vide ou trop long.' using errcode = '23514';
  end if;
  select organizer_id into v_organizer from public.events
  where id = p_event and status = 'published' and public.verification_publicly_visible(verification_status);
  if v_organizer is null then
    raise exception 'Cet événement n''est pas disponible.' using errcode = '23514';
  end if;
  if v_organizer = v_uid then
    raise exception 'Vous organisez cet événement.' using errcode = '23514';
  end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = v_uid
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = v_organizer
  where c.event_id = p_event
  limit 1;

  if v_conversation is null then
    if (select count(*) from public.conversations where created_by = v_uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Trop de nouvelles conversations en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
    end if;
    insert into public.conversations (created_by, event_id) values (v_uid, p_event) returning id into v_conversation;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conversation, v_uid, now()), (v_conversation, v_organizer, null);
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_uid, btrim(p_body));
  update public.conversation_participants set last_read_at = now(), is_archived = false
  where conversation_id = v_conversation and user_id = v_uid;
  return v_conversation;
end;
$$;
revoke execute on function public.start_event_conversation(uuid, text) from public, anon;
grant execute on function public.start_event_conversation(uuid, text) to authenticated;

-- Conversations et en-tête : le sujet peut aussi être un événement.
drop function public.my_conversations();
create function public.my_conversations()
returns table (
  conversation_id uuid, other_name text, listing_title text, listing_slug text, place_name text, place_slug text,
  event_title text, event_slug text, last_message text, last_message_mine boolean, last_message_at timestamptz, unread bigint
)
language sql stable security definer set search_path = '' as $$
  select c.id,
         coalesce(op.display_name, 'Membre'),
         l.title, l.slug, p.name, p.slug, ev.title, ev.slug,
         left(m.body, 140),
         m.sender_id = me.user_id,
         coalesce(c.last_message_at, c.created_at),
         (select count(*) from public.messages x
           where x.conversation_id = c.id and x.sender_id <> me.user_id and x.deleted_at is null
             and (me.last_read_at is null or x.created_at > me.last_read_at))
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> me.user_id
  left join public.profiles op on op.id = other.user_id
  left join public.listings l on l.id = c.listing_id
  left join public.places p on p.id = c.place_id
  left join public.events ev on ev.id = c.event_id
  left join lateral (
    select body, sender_id from public.messages where conversation_id = c.id and deleted_at is null order by created_at desc limit 1
  ) m on true
  where me.user_id = (select auth.uid()) and not me.is_archived
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

drop function public.conversation_header(uuid);
create function public.conversation_header(p_conversation uuid)
returns table (
  other_name text, other_id uuid,
  listing_id uuid, listing_title text, listing_slug text, listing_active boolean,
  place_name text, place_slug text, event_title text, event_slug text
)
language sql stable security definer set search_path = '' as $$
  select coalesce(op.display_name, 'Membre'), other.user_id, l.id, l.title, l.slug, coalesce(public.listing_is_contactable(l.id), false),
         p.name, p.slug, ev.title, ev.slug
  from public.conversations c
  left join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> (select auth.uid())
  left join public.profiles op on op.id = other.user_id
  left join public.listings l on l.id = c.listing_id
  left join public.places p on p.id = c.place_id
  left join public.events ev on ev.id = c.event_id
  where c.id = p_conversation and public.is_conversation_participant(c.id)
  limit 1
$$;

revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.conversation_header(uuid) from public, anon;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.conversation_header(uuid) to authenticated;
