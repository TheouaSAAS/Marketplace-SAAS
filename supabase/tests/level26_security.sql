-- =============================================================================
-- Niveau 26 : sécurité et anti-fraude (blocage, recours, signaux de fraude,
-- charte de confiance) et matrice d'accès des ressources critiques.
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
  ('00000000-0000-4000-8000-000000002601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur26@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'importun26@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002603', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur26@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002604', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin26@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002605', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'complice26a@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002606', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'complice26b@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000002603';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002604';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_category uuid := (select id from public.categories where slug = 'immobilier-location');
  v_seller uuid := '00000000-0000-4000-8000-000000002601';
  v_pest uuid := '00000000-0000-4000-8000-000000002602';
  v_moderator uuid := '00000000-0000-4000-8000-000000002603';
  v_admin uuid := '00000000-0000-4000-8000-000000002604';
  v_friend_a uuid := '00000000-0000-4000-8000-000000002605';
  v_friend_b uuid := '00000000-0000-4000-8000-000000002606';
  v_listing uuid; v_rejected uuid; v_risky uuid; v_conversation uuid; v_appeal uuid; v_account_appeal uuid;
  v_err text; n int; v_text text;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, price)
  values (v_seller, 'zqf-studio', 'Zqf Studio meublé', repeat('Description de test. ', 3), v_category, v_city, 'published',
          extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact', 80000)
  returning id into v_listing;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, rejection_reason, location, location_precision)
  values (v_seller, 'zqf-refusee', 'Zqf Annonce refusée', repeat('Description de test. ', 3), v_category, v_city, 'rejected', 'Photos manquantes',
          extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact')
  returning id into v_rejected;

  -- Blocage
  perform pg_temp.act_as(v_pest);
  v_conversation := public.start_listing_conversation(v_listing, 'Bonjour, toujours disponible ?');
  perform pg_temp.back();
  perform pg_temp.act_as(v_seller);
  insert into public.user_blocks (blocked_id) values (v_pest);
  perform pg_temp.back();
  perform pg_temp.act_as(v_pest);
  v_err := null;
  begin
    insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_pest, 'Répondez-moi !');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre bloqué ne peut plus écrire', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.start_listing_conversation(v_listing, 'Nouvelle tentative');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni relancer la conversation depuis l''annonce', v_err = '42501', v_err);
  select count(*) into n from public.user_blocks;
  perform pg_temp.record('le membre bloqué ne voit pas qu''il l''est', n = 0, n::text);
  perform pg_temp.back();
  perform pg_temp.act_as(v_seller);
  insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_seller, 'Je ne donne pas suite.');
  perform pg_temp.record('celui qui bloque peut encore répondre', true);
  perform pg_temp.back();

  -- Recours
  perform pg_temp.act_as(v_pest);
  v_err := null;
  begin
    perform public.submit_appeal('listing', v_rejected, 'Ce n''est pas mon annonce mais je conteste.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('on ne conteste que ses propres contenus', v_err = 'P0002', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_seller);
  v_err := null;
  begin
    perform public.submit_appeal('listing', v_listing, 'Annonce publiée, rien à contester ici.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un contenu publié ne se conteste pas', v_err = '23514', v_err);
  v_appeal := public.submit_appeal('listing', v_rejected, 'J''ai ajouté les photos demandées, merci de relire.');
  v_err := null;
  begin
    perform public.submit_appeal('listing', v_rejected, 'Deuxième recours en parallèle.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un seul recours en cours par contenu', v_err = '23505', v_err);
  v_err := null;
  begin
    perform public.decide_appeal(v_appeal, true, 'Auto-validation');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('l''auteur ne tranche pas son propre recours', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_moderator);
  select count(*) into n from public.admin_appeals(true) where id = v_appeal and title = 'Zqf Annonce refusée';
  perform pg_temp.record('la file des recours présente le contenu contesté', n = 1, n::text);
  perform public.decide_appeal(v_appeal, true, 'Photos ajoutées, à relire');
  perform pg_temp.back();
  perform pg_temp.record('un recours accepté renvoie le contenu en relecture',
    (select status::text from public.listings where id = v_rejected) = 'pending'
    and (select status from public.appeals where id = v_appeal) = 'accepted');
  perform pg_temp.record('l''auteur est notifié et la décision journalisée',
    exists (select 1 from public.notifications where user_id = v_seller and title = 'Recours accepté')
    and exists (select 1 from public.admin_audit_log where action = 'recours.accepte' and entity_id = v_appeal and actor_id = v_moderator));

  update public.profiles set is_suspended = true where id = v_pest;
  perform pg_temp.act_as(v_pest);
  v_account_appeal := public.submit_appeal('account', v_pest, 'Je n''ai envoyé que deux messages polis.');
  perform pg_temp.back();
  perform pg_temp.act_as(v_moderator);
  v_err := null;
  begin
    perform public.decide_appeal(v_account_appeal, true, 'Réactivation');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('seul un administrateur réactive un compte', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_admin);
  perform public.decide_appeal(v_account_appeal, false, 'Messages répétés malgré le refus');
  perform pg_temp.back();
  perform pg_temp.record('un recours refusé laisse la sanction et transmet le motif',
    (select is_suspended from public.profiles where id = v_pest)
    and exists (select 1 from public.notifications where user_id = v_pest and title = 'Recours refusé' and body like 'Motif : Messages répétés%'));

  -- Signaux de fraude
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, contact_phone)
  values (v_friend_a, 'zqf-a', 'Zqf Logement A', repeat('Description de test. ', 3), v_category, v_city, 'published',
          extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact', '07 11 22 33 44'),
         (v_friend_b, 'zqf-b', 'Zqf Logement B', repeat('Description de test. ', 3), v_category, v_city, 'published',
          extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact', '+225 0711223344');
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, contact_phone)
  values (v_seller, 'zqf-risque', 'Zqf Villa à prix cassé', 'Envoyez un acompte par Western Union, détails sur bit.ly/zqf avant la visite.', v_category, v_city, 'draft',
          extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact', '0711223344')
  returning id into v_risky;

  perform pg_temp.act_as(v_moderator);
  select string_agg(code, ',' order by code), sum(weight) into v_text, n from public.listing_fraud_signals(v_risky);
  perform pg_temp.record('les indices sont relevés (paiement d''avance, lien raccourci, numéro partagé)',
    v_text like '%lien_raccourci%' and v_text like '%numero_partage%' and v_text like '%paiement_avance%' and n >= 8, v_text || ' = ' || n);
  perform pg_temp.back();
  perform pg_temp.act_as(v_seller);
  select count(*) into n from public.listing_fraud_signals(v_risky);
  perform pg_temp.record('un membre ne voit pas les signaux de fraude', n = 0, n::text);
  v_err := null;
  begin
    perform * from public.fraud_signals_for(v_risky);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le calcul interne n''est pas appelable depuis l''API', v_err = '42501', v_err);
  update public.listings set status = 'pending' where id = v_risky;
  perform pg_temp.back();
  perform pg_temp.record('une annonce à risque soumise alerte l''équipe, sans la sanctionner',
    exists (select 1 from public.notifications where user_id = v_moderator and type = 'securite' and title like '%Zqf Villa%')
    and (select status::text from public.listings where id = v_risky) = 'pending');
  perform pg_temp.act_as(v_moderator);
  select count(*) into n from public.fraud_review_queue() where listing_id = v_risky;
  perform pg_temp.record('elle figure dans la file de revue de l''équipe', n = 1, n::text);
  perform pg_temp.back();

  -- Charte de confiance
  perform pg_temp.act_as(v_pest);
  insert into public.charter_acceptances (role, version) values ('visiteur', '2026-10');
  perform pg_temp.record('un membre accepte la charte en son nom', exists (select 1 from public.charter_acceptances where user_id = v_pest));
  v_err := null;
  begin
    insert into public.charter_acceptances (user_id, role, version) values (v_seller, 'annonceur', '2026-10');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('jamais au nom d''un autre', v_err = '42501', v_err);
  v_err := null;
  begin
    insert into public.charter_acceptances (role, version, accepted_at) values ('annonceur', '2026-10', now() - interval '1 year');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni à une date antidatée', v_err = '42501', v_err);
  perform pg_temp.back();

  -- Matrice d'accès : visiteur anonyme
  perform pg_temp.act_as(null);
  v_text := '';
  for v_err in select unnest(array['notification_deliveries', 'appeals', 'user_blocks', 'charter_acceptances', 'admin_audit_log', 'content_revisions', 'ai_usage', 'reports', 'messages', 'contact_requests'])
  loop
    begin
      execute format('select count(*) from public.%I', v_err) into n;
      if n > 0 then v_text := v_text || v_err || ' '; end if;
    exception when others then null;
    end;
  end loop;
  perform pg_temp.record('un visiteur anonyme ne lit aucune donnée privée', v_text = '', v_text);
  v_err := null;
  begin
    perform public.admin_overview();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni les outils d''administration', v_err = '42501', v_err);
  perform pg_temp.back();

  -- Matrice d'accès : membre ordinaire
  perform pg_temp.act_as(v_friend_a);
  update public.listings set title = 'Zqf piratée' where id = v_listing;
  perform pg_temp.record('un membre ne modifie pas l''annonce d''un autre', (select title from public.listings where id = v_listing) = 'Zqf Studio meublé');
  v_err := null;
  begin
    update public.profiles set role = 'admin' where id = v_friend_a;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni ne s''attribue un rôle d''administration', v_err = '42501', v_err);
  select count(*) into n from public.messages where conversation_id = v_conversation;
  perform pg_temp.record('ni ne lit les messages d''une conversation d''autrui', n = 0, n::text);
  select count(*) into n from storage.objects where bucket_id = 'private-media' and (storage.foldername(name))[1] <> v_friend_a::text;
  perform pg_temp.record('ni les fichiers privés d''autrui', n = 0, n::text);
  select count(*) into n from public.notifications where user_id <> v_friend_a;
  perform pg_temp.record('ni les notifications d''autrui', n = 0, n::text);
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
