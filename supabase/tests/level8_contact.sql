-- =============================================================================
-- Niveau 8 (1/2) : coordonnées, messagerie, état des annonces.
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
  ('00000000-0000-4000-8000-000000000081', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur8@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000082', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acheteur8@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000083', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tiers8@test.invalid', '{}', now(), now());

insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision,
                             show_phone, contact_phone, availability_status)
select '00000000-0000-4000-8000-000000000081', v.slug, v.title, repeat('Description de test. ', 3),
       (select id from public.categories where slug = 'immobilier-location'), (select id from public.cities where is_default),
       v.status::public.content_status, extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact',
       true, '07 07 12 34 56', v.availability::public.availability_status
from (values
  ('l8-active', 'Annonce active de test', 'published', 'available'),
  ('l8-indispo', 'Annonce indisponible', 'published', 'unavailable'),
  ('l8-brouillon', 'Annonce brouillon', 'draft', 'available'),
  ('l8-expiree', 'Annonce expirée test', 'published', 'available')
) as v(slug, title, status, availability);
update public.listings set published_at = now() - interval '20 days', expires_at = now() - interval '1 day' where slug = 'l8-expiree';

do $$
declare
  v_active uuid := (select id from public.listings where slug = 'l8-active');
  v_indispo uuid := (select id from public.listings where slug = 'l8-indispo');
  v_err text; v_value text; v_conv uuid; v_conv2 uuid; n int;
begin
  -- Coordonnées
  perform pg_temp.act_as(null);
  begin perform public.reveal_listing_contact(v_active, 'phone'); exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('un visiteur non connecté ne voit aucune coordonnée', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000082');
  v_value := public.reveal_listing_contact(v_active, 'phone');
  v_err := null;
  begin perform public.reveal_listing_contact(v_active, 'whatsapp'); exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('un membre voit le téléphone partagé par l''annonceur', v_value = '07 07 12 34 56', v_value);
  perform pg_temp.record('une coordonnée non partagée reste privée', v_err = '23514', v_err);
  select count(*) into n from public.contact_reveals where listing_id = v_active;
  perform pg_temp.record('chaque affichage de coordonnée est tracé', n = 1, n::text);

  insert into public.contact_reveals (listing_id, user_id, channel)
  select v_active, '00000000-0000-4000-8000-000000000082', 'phone' from generate_series(1, 19);
  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000082');
  begin perform public.reveal_listing_contact(v_active, 'phone'); exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('au-delà de 20 coordonnées par heure : refus', v_err = 'CP429', v_err);

  -- Messagerie
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000082');
  v_conv := public.start_listing_conversation(v_active, 'Bonjour, est-ce disponible ?');
  v_conv2 := public.start_listing_conversation(v_active, 'Je relance ma question.');
  v_err := null;
  begin perform public.start_listing_conversation(v_indispo, 'Bonjour'); exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('un second message reprend la même conversation', v_conv = v_conv2, v_conv::text);
  perform pg_temp.record('une annonce indisponible ne peut pas être sollicitée', v_err = '23514', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000081');
  select count(*) into n from public.messages where conversation_id = v_conv;
  v_err := null;
  begin perform public.start_listing_conversation(v_active, 'Moi-même'); exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('l''annonceur reçoit les messages', n = 2, n::text);
  perform pg_temp.record('on ne s''écrit pas sur sa propre annonce', v_err = '23514', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000083');
  select count(*) into n from public.messages where conversation_id = v_conv;
  perform pg_temp.record('un tiers ne lit pas la conversation', n = 0, n::text);
  select count(*) into n from public.conversation_header(v_conv);
  perform pg_temp.back();
  perform pg_temp.record('un tiers n''obtient pas l''en-tête de la conversation', n = 0, n::text);

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000082');
  begin
    for i in 1..16 loop
      insert into public.messages (conversation_id, sender_id, body) values (v_conv, '00000000-0000-4000-8000-000000000082', 'Message ' || i);
    end loop;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('trop de messages en une minute : refus', v_err = 'CP429', v_err);
end $$;

-- État public des annonces
do $$
declare n_expired int; n_draft int; v_state text;
begin
  perform pg_temp.act_as(null);
  select state into v_state from public.listing_public_state('l8-expiree');
  select count(*) into n_draft from public.listing_public_state('l8-brouillon');
  select count(*) into n_expired from public.listings where slug = 'l8-expiree';
  perform pg_temp.back();
  perform pg_temp.record('une annonce expirée est annoncée comme telle', v_state = 'expired', v_state);
  perform pg_temp.record('un brouillon reste introuvable', n_draft = 0, n_draft::text);
  perform pg_temp.record('une annonce expirée n''est plus lisible directement', n_expired = 0, n_expired::text);
end $$;

select test, ok, detail from results order by n;
rollback;
