-- =============================================================================
-- Niveau 16 : événements (modération, ordre, report, annulation, rappels, archivage, messagerie).
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated;
grant usage on sequence results_n_seq to anon, authenticated;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', 'aal2')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.record(p_test text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;


insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'orga16@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'public16@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'modo16@test.invalid', '{}', now(), now());
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000703';

-- Événements publiés directement (contexte système) pour l'ordre, les filtres et les rappels.
insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, ends_at, is_free, status)
select '00000000-0000-4000-8000-000000000701', v.slug, v.title, repeat('Description de test. ', 3),
       (select id from public.categories where slug = 'sport'), (select id from public.cities where is_default),
       now() + v.starts::interval, now() + v.ends::interval, v.free, v.status::public.content_status
from (values
  ('e16-demain', 'Zqe Tournoi demain', '1 day', '1 day 3 hours', true, 'published'),
  ('e16-bientot', 'Zqe Match dans deux heures', '2 hours', '4 hours', false, 'published'),
  ('e16-passe', 'Zqe Course passée', '-3 days', '-70 hours', true, 'published'),
  ('e16-ancien', 'Zqe Fête ancienne', '-40 days', '-958 hours', true, 'published')
) as v(slug, title, starts, ends, free, status);

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_orga uuid := '00000000-0000-4000-8000-000000000701';
  v_public uuid := '00000000-0000-4000-8000-000000000702';
  v_modo uuid := '00000000-0000-4000-8000-000000000703';
  v_tomorrow uuid := (select id from public.events where slug = 'e16-demain');
  v_soon uuid := (select id from public.events where slug = 'e16-bientot');
  v_pending uuid; v_ids uuid[]; v_err text; n int; v_conv uuid; v_original timestamptz;
begin
  perform pg_temp.record('catégories d''événements : formation, communauté, tourisme, autres',
    (select count(*) from public.categories c join public.categories p on p.id = c.parent_id
     where p.slug = 'evenements' and c.slug in ('ateliers-formations', 'communaute-solidarite', 'sorties-tourisme', 'autres-evenements')) = 4);

  -- Publication soumise à la modération
  perform pg_temp.act_as(v_orga);
  begin
    insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, status)
    values (v_orga, 'e16-direct', 'Zqe Publication directe', repeat('Description de test. ', 3),
            (select id from public.categories where slug = 'sport'), v_city, now() + interval '5 days', 'published');
  exception when others then v_err := sqlstate;
  end;
  insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, status)
  values (v_orga, 'e16-propose', 'Zqe Événement proposé', repeat('Description de test. ', 3),
          (select id from public.categories where slug = 'sport'), v_city, now() + interval '5 days', 'pending')
  returning id into v_pending;
  perform pg_temp.back();
  perform pg_temp.record('un organisateur ne publie pas directement', v_err = '42501', v_err);
  perform pg_temp.act_as(null);
  select count(*) into n from public.events where id = v_pending;
  perform pg_temp.back();
  perform pg_temp.record('un événement en attente n''est pas public', n = 0, n::text);
  perform pg_temp.act_as(v_modo);
  update public.events set status = 'published' where id = v_pending;
  perform pg_temp.back();
  perform pg_temp.record('la modération publie et l''organisateur est notifié',
    exists (select 1 from public.notifications where user_id = v_orga and title = 'Événement publié : Zqe Événement proposé'));

  -- Ordre et filtres
  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_events(v_city, p_query => 'zqe');
  perform pg_temp.record('triés dans le temps, aucun événement passé', v_ids[1] = v_soon and v_ids[2] = v_tomorrow and cardinality(v_ids) = 3, v_ids::text);
  select array_agg(id) into v_ids from public.search_events(v_city, p_query => 'zqe', p_free => true);
  perform pg_temp.record('filtre gratuit', v_ids = array[v_tomorrow], v_ids::text);
  select array_agg(id) into v_ids from public.search_events(v_city, p_query => 'zqe', p_from => now(), p_to => now() + interval '6 hours');
  perform pg_temp.record('filtre de période', v_ids = array[v_soon], v_ids::text);
  perform pg_temp.back();

  -- Favori puis report / annulation
  insert into public.favorites (user_id, event_id) values (v_public, v_tomorrow), (v_public, v_soon);
  v_err := null;
  perform pg_temp.act_as(v_public);
  begin
    perform public.change_event_schedule(v_tomorrow, 'annuler', 'Pas mon événement');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('seul l''organisateur change le programme', v_err = '42501', v_err);

  select starts_at into v_original from public.events where id = v_tomorrow;
  perform pg_temp.act_as(v_orga);
  v_err := null;
  begin
    perform public.change_event_schedule(v_tomorrow, 'reporter', '', now() + interval '8 days');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un report doit être expliqué', v_err = '23514', v_err);
  perform public.change_event_schedule(v_tomorrow, 'reporter', 'Terrain indisponible', now() + interval '8 days');
  perform public.change_event_schedule(v_soon, 'annuler', 'Intempéries annoncées');
  perform pg_temp.back();
  perform pg_temp.record('un report reste publié, avec la date initiale',
    exists (select 1 from public.events where id = v_tomorrow and status = 'published' and schedule_status = 'postponed' and original_starts_at = v_original));
  perform pg_temp.record('une annulation reste visible avec son motif',
    exists (select 1 from public.events where id = v_soon and status = 'published' and schedule_status = 'cancelled' and schedule_note = 'Intempéries annoncées'));
  select count(*) into n from public.notifications where user_id = v_public and type = 'evenement';
  perform pg_temp.record('les personnes qui l''ont en favori sont prévenues', n = 2, n::text);

  -- Rappels et archivage
  update public.events set schedule_status = 'scheduled', schedule_note = null where id = v_soon;
  n := public.send_event_reminders();
  perform pg_temp.record('rappel la veille pour un favori', n >= 1
    and exists (select 1 from public.notifications where user_id = v_public and type = 'rappel'), n::text);
  perform pg_temp.record('un seul rappel par personne et par événement', not exists (
    select 1 from public.event_reminders r where r.event_id = v_soon group by r.user_id having count(*) > 1)
    and (select count(*) from public.notifications where user_id = v_public and type = 'rappel') = 1
    and public.send_event_reminders() = 0);
  perform public.archive_past_events();
  perform pg_temp.record('archivage automatique 30 jours après la fin',
    (select status from public.events where slug = 'e16-ancien') = 'archived' and (select status from public.events where slug = 'e16-passe') = 'published');

  -- Messagerie avec l'organisateur
  perform pg_temp.act_as(v_public);
  v_conv := public.start_event_conversation(v_tomorrow, 'Bonjour, l''entrée est-elle libre ?');
  select count(*) into n from public.my_conversations() where event_slug = 'e16-demain';
  perform pg_temp.back();
  perform pg_temp.record('on écrit à l''organisateur depuis l''événement',
    n = 1 and exists (select 1 from public.conversation_participants where conversation_id = v_conv and user_id = v_orga), n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
