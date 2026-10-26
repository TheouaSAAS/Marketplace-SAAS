-- =============================================================================
-- Niveau 8 (2/2) : « j'aime », commentaires, signalements, tables internes.
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
  ('00000000-0000-4000-8000-000000000084', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur8b@test.invalid', '{"display_name":"Vendeur Test"}', now(), now()),
  ('00000000-0000-4000-8000-000000000085', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membre8b@test.invalid', '{}', now(), now());

insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
select '00000000-0000-4000-8000-000000000084', v.slug, v.title, repeat('Description de test. ', 3),
       (select id from public.categories where slug = 'immobilier-location'), (select id from public.cities where is_default),
       v.status::public.content_status, extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact'
from (values ('l8b-active', 'Annonce engagement test', 'published'), ('l8b-brouillon', 'Brouillon engagement', 'draft')) as v(slug, title, status);

do $$
declare
  v_active uuid := (select id from public.listings where slug = 'l8b-active');
  v_draft uuid := (select id from public.listings where slug = 'l8b-brouillon');
  v_comment uuid; v_err text; r record; n int;
begin
  -- « J'aime »
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  insert into public.listing_likes (listing_id, user_id) values (v_active, '00000000-0000-4000-8000-000000000085');
  begin
    insert into public.listing_likes (listing_id, user_id) values (v_draft, '00000000-0000-4000-8000-000000000085');
  exception when others then v_err := sqlstate;
  end;
  select * into r from public.listing_engagement(v_active);
  perform pg_temp.back();
  perform pg_temp.record('un membre aime une annonce publiée', r.likes = 1 and r.liked, r.likes || '/' || r.liked);
  perform pg_temp.record('on ne peut pas aimer un brouillon', v_err = '42501', v_err);

  perform pg_temp.act_as(null);
  select * into r from public.listing_engagement(v_active);
  perform pg_temp.back();
  perform pg_temp.record('le visiteur voit le total, pas qui aime', r.likes = 1 and not r.liked, r.likes || '/' || r.liked);

  -- Commentaires
  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  begin
    insert into public.listing_comments (listing_id, author_id, body) values (v_active, '00000000-0000-4000-8000-000000000085', 'Appelez-moi au 07 07 12 34 56');
  exception when others then v_err := sqlstate;
  end;
  insert into public.listing_comments (listing_id, author_id, body)
  values (v_active, '00000000-0000-4000-8000-000000000085', 'Le loyer comprend-il l''eau ?') returning id into v_comment;
  perform pg_temp.back();
  perform pg_temp.record('pas de téléphone dans un commentaire public', v_err = '23514', v_err);

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  begin
    insert into public.listing_comments (listing_id, author_id, parent_id, body) values (v_active, '00000000-0000-4000-8000-000000000085', v_comment, 'Réponse');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('seul l''annonceur répond à un commentaire', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000084');
  insert into public.listing_comments (listing_id, author_id, parent_id, body) values (v_active, '00000000-0000-4000-8000-000000000084', v_comment, 'Oui, l''eau est comprise.');
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*), bool_or(is_seller) into r from public.listing_comment_thread(v_active);
  perform pg_temp.back();
  perform pg_temp.record('le fil public montre la question et la réponse de l''annonceur', r.count = 2 and r.bool_or, r.count || '/' || r.bool_or);

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  begin update public.listing_comments set body = 'Texte modifié' where id = v_comment; exception when others then v_err := sqlstate; end;
  perform pg_temp.back();
  perform pg_temp.record('un commentaire publié ne se réécrit pas', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000084');
  update public.listing_comments set status = 'hidden' where id = v_comment;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*) into n from public.listing_comment_thread(v_active) where parent_id is null;
  perform pg_temp.back();
  perform pg_temp.record('l''annonceur masque un commentaire', n = 0, n::text);

  -- Signalements
  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  insert into public.reports (reporter_id, listing_id, reason) values ('00000000-0000-4000-8000-000000000085', v_active, 'arnaque');
  begin
    insert into public.reports (reporter_id, listing_id, reason) values ('00000000-0000-4000-8000-000000000085', v_active, 'doublon');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un seul signalement ouvert par personne et par contenu', v_err = '23505', v_err);

  -- Tables internes
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000085');
  select (select count(*) from public.contact_reveals) + (select count(*) from public.listing_view_counts) + (select count(*) from public.listing_view_marks) into n;
  perform pg_temp.back();
  perform pg_temp.record('les tables internes sont illisibles par l''API', n = 0, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
