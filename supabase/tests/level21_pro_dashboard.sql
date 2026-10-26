-- =============================================================================
-- Niveau 21 : espace professionnel (séparation des équipes, rôles, statistiques
-- agrégées, boîte de réception, historique de modération, vues des pages).
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

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000002101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'titulaire21@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur21@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lecteur21@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'concurrent21@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client21@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002106', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur21@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000002106';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_category uuid := (select id from public.categories where slug = 'plomberie');
  v_owner uuid := '00000000-0000-4000-8000-000000002101';
  v_editor uuid := '00000000-0000-4000-8000-000000002102';
  v_viewer uuid := '00000000-0000-4000-8000-000000002103';
  v_rival uuid := '00000000-0000-4000-8000-000000002104';
  v_client uuid := '00000000-0000-4000-8000-000000002105';
  v_moderator uuid := '00000000-0000-4000-8000-000000002106';
  v_org uuid; v_page uuid; v_rival_page uuid; v_listing uuid; v_request uuid; v_err text; n int; v_bool boolean;
begin
  -- Deux pages, deux équipes distinctes
  insert into public.organizations (name, slug, kind, city_id, created_by) values ('Zqs Plomberie', 'zqs-equipe', 'artisan', v_city, v_owner) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_editor, 'editor'), (v_org, v_viewer, 'viewer');
  insert into public.business_profiles (owner_id, organization_id, slug, name, category_id, city_id, status, accepts_quotes)
  values (v_owner, v_org, 'zqs-plomberie', 'Zqs Plomberie', v_category, v_city, 'published', true) returning id into v_page;
  insert into public.business_profiles (owner_id, slug, name, category_id, city_id, status)
  values (v_rival, 'zqs-concurrent', 'Zqs Concurrent', v_category, v_city, 'published') returning id into v_rival_page;

  -- Demande de devis d'un client à la page
  perform pg_temp.act_as(v_client);
  insert into public.contact_requests (business_id, sender_id, sender_name, sender_phone, message, kind, consented_at, recipient_id)
  values (v_page, v_client, 'Zqs Client', '0700000000', 'Fuite sous l''évier, devis svp.', 'devis', now(), v_client) returning id into v_request;
  perform pg_temp.back();

  perform pg_temp.act_as(v_editor);
  select count(*) into n from public.contact_requests where id = v_request;
  perform pg_temp.record('un éditeur de l''équipe voit la demande adressée à la page', n = 1, n::text);
  update public.contact_requests set status = 'replied' where id = v_request;
  perform pg_temp.record('il en change le statut', (select status from public.contact_requests where id = v_request) = 'replied');
  v_err := null;
  begin
    update public.contact_requests set message = 'modifié' where id = v_request;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le contenu d''une demande ne se modifie pas', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_viewer);
  select count(*) into n from public.contact_requests where id = v_request;
  perform pg_temp.record('un lecteur ne voit pas les coordonnées des demandeurs', n = 0, n::text);
  perform pg_temp.back();
  perform pg_temp.act_as(v_rival);
  select count(*) into n from public.contact_requests where id = v_request;
  perform pg_temp.record('une autre équipe ne voit pas la demande', n = 0, n::text);
  perform pg_temp.back();

  -- Annonce rattachée à la page : réservé à ses gestionnaires
  perform pg_temp.act_as(v_rival);
  v_err := null;
  begin
    insert into public.listings (owner_id, business_id, slug, title, description, category_id, city_id, status)
    values (v_rival, v_page, 'zqs-intrus', '', '', v_category, v_city, 'draft');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('on ne publie pas au nom de la page d''un autre', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_editor);
  insert into public.listings (owner_id, business_id, organization_id, slug, title, description, category_id, city_id, status)
  values (v_editor, v_page, v_org, 'zqs-depannage', 'Zqs Dépannage plomberie', 'Dépannage rapide de plomberie à domicile.', v_category, v_city, 'draft')
  returning id into v_listing;
  update public.listings set location = 'SRID=4326;POINT(-6.6363 4.7485)', location_precision = 'approximate', status = 'pending' where id = v_listing;
  perform pg_temp.back();
  perform pg_temp.act_as(v_moderator);
  update public.listings set status = 'rejected', rejection_reason = 'Photo manquante' where id = v_listing;
  perform pg_temp.back();

  -- Annonces, statistiques et historique de la page
  perform pg_temp.act_as(v_viewer);
  select count(*) into n from public.pro_listings(v_page);
  perform pg_temp.record('un lecteur voit les annonces de la page, tous statuts', n = 1, n::text);
  select count(*) into n from public.pro_moderation_history(v_page) where reason = 'Photo manquante';
  perform pg_temp.record('l''historique de modération montre la correction demandée', n = 1, n::text);
  perform pg_temp.record('les statistiques sont des agrégats (demandes comptées)',
    (select requests_total = 1 and requests_unanswered = 0 from public.pro_stats(v_page)));
  perform pg_temp.back();
  perform pg_temp.act_as(v_rival);
  select count(*) into n from public.pro_listings(v_page);
  perform pg_temp.record('une autre équipe ne voit rien des annonces de la page', n = 0, n::text);
  select count(*) into n from public.pro_stats(v_page);
  perform pg_temp.record('ni ses statistiques', n = 0, n::text);
  select count(*) into n from public.pro_moderation_history(v_page);
  perform pg_temp.record('ni son historique', n = 0, n::text);
  perform pg_temp.back();

  -- Vues d'une page : un visiteur distinct par jour, page publiée seulement
  perform pg_temp.record('première vue comptée', public.record_business_view(v_page, repeat('a', 64)));
  perform pg_temp.record('même visiteur le même jour : pas recompté', not public.record_business_view(v_page, repeat('a', 64)));
  perform public.record_business_view(v_page, repeat('b', 64));
  perform pg_temp.act_as(v_owner);
  perform pg_temp.record('le titulaire voit 2 vues', (select page_views = 2 from public.pro_stats(v_page)));
  perform pg_temp.back();
  update public.business_profiles set status = 'archived' where id = v_rival_page;
  perform pg_temp.record('une page non publiée ne compte pas de vue', not public.record_business_view(v_rival_page, repeat('c', 64)));
  perform pg_temp.act_as(v_owner);
  v_err := null;
  begin
    perform public.record_business_view(v_page, repeat('d', 64));
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le comptage n''est pas appelable par un membre', v_err = '42501', v_err);
  select count(*) into n from public.business_view_marks;
  perform pg_temp.back();
  perform pg_temp.record('les empreintes de vues sont illisibles', n = 0, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
