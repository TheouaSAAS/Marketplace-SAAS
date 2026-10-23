-- =============================================================================
-- Niveau 23 : couche IA (base de connaissances vérifiée, recherche des
-- passages, interrupteur général, suivi de consommation).
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
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
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
  ('00000000-0000-4000-8000-000000002301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin23@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur23@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002301';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000002302';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_admin uuid := '00000000-0000-4000-8000-000000002301';
  v_moderator uuid := '00000000-0000-4000-8000-000000002302';
  v_source uuid; v_place uuid; v_pending uuid; v_event uuid; v_err text; n int; v_text text;
begin
  insert into public.sources (kind, title, collected_at) values ('terrain', 'Zqk relevé terrain', current_date) returning id into v_source;
  insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, verified_at, verified_by, source_id, summary, description)
  values ('etablissement', v_admin, 'zqk-quincaillerie', 'Zqk Quincaillerie du marché', (select id from public.categories where slug = 'alimentation'), v_city,
          'published', 'verified', now(), v_admin, v_source, 'Quincaillerie zqkunique', 'Vente de ciment, tôles et outillage zqkunique.')
  returning id into v_place;
  insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, description)
  values ('etablissement', v_admin, 'zqk-attente', 'Zqk Boutique en attente', (select id from public.categories where slug = 'alimentation'), v_city,
          'published', 'pending_validation', 'Boutique zqkattente non vérifiée.')
  returning id into v_pending;

  select count(*) into n from public.knowledge_documents where entity_type = 'place' and entity_id = v_place and url_path = '/lieux/zqk-quincaillerie';
  perform pg_temp.record('un lieu publié et vérifié entre dans la base de connaissances', n = 1, n::text);
  select count(*) into n from public.knowledge_documents where entity_type = 'place' and entity_id = v_pending;
  perform pg_temp.record('un lieu non vérifié n''y entre pas', n = 0, n::text);

  perform pg_temp.act_as(null);
  select count(*), max(title), max(source_title) into n, v_text, v_err from public.search_knowledge('Où acheter des tôles zqkunique ?');
  perform pg_temp.record('un visiteur retrouve le passage vérifié, avec sa source', n >= 1 and v_text = 'Zqk Quincaillerie du marché' and v_err = 'Zqk relevé terrain', coalesce(v_text, '-'));
  select count(*) into n from public.search_knowledge('zqkattente');
  perform pg_temp.record('aucun passage non vérifié n''est jamais renvoyé', n = 0, n::text);
  select count(*) into n from public.search_knowledge('xqzvwk plorbitude introuvable');
  perform pg_temp.record('une question sans rapport ne renvoie rien (refus honnête possible)', n = 0, n::text);
  select count(*) into n from public.search_knowledge('le la les de du');
  perform pg_temp.record('une question vide de sens ne renvoie rien', n = 0, n::text);
  v_err := null;
  begin
    insert into public.knowledge_documents (entity_type, entity_id, title, content, verification_status, content_hash) values ('place', gen_random_uuid(), 'Faux', 'Faux', 'verified', 'x');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('personne n''écrit dans la base de connaissances depuis l''API', v_err = '42501', v_err);
  perform pg_temp.back();

  update public.places set verification_status = 'pending_validation' where id = v_place;
  select count(*) into n from public.knowledge_documents where entity_id = v_place;
  perform pg_temp.record('un lieu qui perd sa vérification en sort aussitôt', n = 0, n::text);
  update public.places set verification_status = 'verified', verified_at = now(), verified_by = v_admin, source_id = v_source, description = 'Nouvelle description zqkmodif.' where id = v_place;
  select count(*) into n from public.knowledge_chunks c join public.knowledge_documents d on d.id = c.document_id where d.entity_id = v_place and c.content like '%zqkmodif%';
  perform pg_temp.record('une modification met à jour les passages', n = 1, n::text);

  insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, ends_at, is_free, status, verification_status, verified_at, verified_by, source_id)
  values (v_admin, 'zqk-fete', 'Zqk Fête du port', 'Concert zqkfete sur le port.', (select id from public.categories where slug = 'sport'), v_city,
          now() + interval '3 days', now() + interval '3 days 4 hours', true, 'published', 'verified', now(), v_admin, v_source)
  returning id into v_event;
  select count(*) into n from public.knowledge_documents where entity_id = v_event and content like '%Date :%';
  perform pg_temp.record('un événement vérifié à venir y entre, avec sa date', n = 1, n::text);
  update public.events set schedule_status = 'cancelled', schedule_note = 'Météo défavorable' where id = v_event;
  select count(*) into n from public.knowledge_documents where entity_id = v_event;
  perform pg_temp.record('un événement annulé en sort', n = 0, n::text);

  -- Interrupteur général et consommation
  perform pg_temp.act_as(v_moderator);
  v_err := null;
  begin
    perform public.set_ai_kill_switch(true, 'Coût anormal constaté');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un modérateur ne coupe pas l''IA', v_err = '42501', v_err);
  v_err := null;
  begin
    perform * from public.ai_usage_summary();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni ne lit la consommation', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_admin);
  v_err := null;
  begin
    perform public.set_ai_kill_switch(true, '');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('couper l''IA exige une raison', v_err = '23514', v_err);
  perform public.set_ai_kill_switch(true, 'Coût anormal constaté');
  perform pg_temp.back();
  perform pg_temp.record('l''administrateur coupe toute l''IA, décision journalisée',
    (select (value ->> 'disabled')::boolean from public.platform_settings where key = 'ai.kill_switch')
    and exists (select 1 from public.admin_audit_log where action = 'ia.arret' and actor_id = v_admin and details ->> 'raison' = 'Coût anormal constaté'));

  insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens, cost_usd) values (null, 'assistant', 'claude-opus-5-5', 1200, 300, 0.0108);
  perform pg_temp.act_as(v_admin);
  select calls into n from public.ai_usage_summary() where feature = 'assistant';
  perform pg_temp.record('la consommation de l''assistant est suivie, sans contenu', n >= 1, n::text);
  perform pg_temp.back();
  perform pg_temp.record('le journal de consommation ne contient aucune question ni réponse',
    not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_usage' and column_name in ('prompt', 'question', 'answer', 'content', 'response')));
end $$;

select test, ok, detail from results order by n;
rollback;
