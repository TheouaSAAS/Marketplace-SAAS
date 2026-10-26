-- =============================================================================
-- Niveau 13 : guide pratique (versions, vérification, suggestions, assistant).
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
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur13@test.invalid', '{"display_name":"Zqg Éditrice"}', now(), now()),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lecteur13@test.invalid', '{}', now(), now());
update public.profiles set role = 'local_editor', display_name = 'Zqg Éditrice' where id = '00000000-0000-4000-8000-000000000401';
insert into public.sources (kind, title, collected_at) values ('officiel', 'Zqg Mairie', current_date);

do $$
declare
  v_section uuid := (select id from public.guide_sections where slug = 'sante');
  v_source uuid := (select id from public.sources where title = 'Zqg Mairie');
  v_article uuid; v_err text; n int; v_version int; v_note text; v_status text;
  v_editor uuid := '00000000-0000-4000-8000-000000000401';
  v_reader uuid := '00000000-0000-4000-8000-000000000402';
  v_suggestion uuid;
begin
  perform pg_temp.record('les rubriques sont reliées aux catégories du site',
    (select category_slugs from public.guide_sections where slug = 'sante') = '{sante}');

  perform pg_temp.act_as(v_reader);
  begin
    perform public.save_guide_article(null, v_section, 'zqg-sante', 'Se soigner (test)', null, 'Texte de test assez long pour être valide.', 'draft', 'pending_validation', null, 'Création');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne rédige pas le guide', v_err = '42501', v_err);

  perform pg_temp.act_as(v_editor);
  v_err := null;
  begin
    perform public.save_guide_article(null, v_section, 'zqg-sante', 'Se soigner (test)', null, 'Texte de test assez long pour être valide.', 'draft', 'pending_validation', null, '');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une modification sans note est refusée', v_err = '23514', v_err);
  v_article := public.save_guide_article(null, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Premier paragraphe.' || E'\n\n' || repeat('Deuxième paragraphe très long. ', 60), 'published', 'pending_validation', null, 'Création de l''article');
  perform public.save_guide_article(v_article, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Texte corrigé, assez long pour être valide.', 'published', 'pending_validation', null, 'Correction du texte');
  perform public.save_guide_article(v_article, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Texte corrigé, assez long pour être valide.', 'published', 'pending_validation', null, 'Changement de statut seul');
  v_err := null;
  begin
    perform public.save_guide_article(v_article, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Texte corrigé, assez long pour être valide.', 'published', 'verified', null, 'Vérifié sans source');
  exception when others then v_err := sqlstate;
  end;
  perform public.save_guide_article(v_article, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Texte corrigé, assez long pour être valide.', 'published', 'verified', v_source, 'Vérification en mairie');
  perform pg_temp.back();

  select version into v_version from public.guide_articles where id = v_article;
  select change_note into v_note from public.guide_article_versions where article_id = v_article and version = 2;
  perform pg_temp.record('chaque changement du texte crée une version, avec sa note', v_version = 2 and v_note = 'Correction du texte', v_version || ' ' || coalesce(v_note, '∅'));
  perform pg_temp.record('« vérifié » exige une source', v_err = '23514', v_err);
  perform pg_temp.record('la vérification est datée et attribuée par la base',
    exists (select 1 from public.guide_articles where id = v_article and verified_at is not null and verified_by = v_editor));

  perform pg_temp.record('un article publié alimente l''assistant, découpé en passages',
    (select count(*) from public.knowledge_chunks c join public.knowledge_documents d on d.id = c.document_id where d.entity_id = v_article) >= 1
    and exists (select 1 from public.knowledge_documents where entity_id = v_article and url_path = '/guide/sante/zqg-sante' and verification_status = 'verified'));
  perform pg_temp.record('passages de 1 200 caractères au plus', (select max(char_length(c)) from public.chunk_text(repeat('mot ', 1000)) c) <= 1200);

  perform pg_temp.act_as(null);
  select count(*) into n from public.guide_article_history(v_article);
  perform pg_temp.record('historique public des versions (dates et notes)', n = 2, n::text);
  perform pg_temp.record('crédits : auteur et source', exists (select 1 from public.guide_article_credits(v_article) where author_name = 'Zqg Éditrice' and source_title = 'Zqg Mairie'));
  perform pg_temp.back();

  -- Suggestions
  perform pg_temp.act_as(v_reader);
  insert into public.guide_suggestions (article_id, user_id, message, status) values (v_article, v_reader, 'Le numéro indiqué a changé, à vérifier.', 'resolved')
  returning id into v_suggestion;
  update public.guide_suggestions set status = 'resolved' where id = v_suggestion;
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('une suggestion est créée « ouverte »', (select status::text from public.guide_suggestions where id = v_suggestion) = 'open');
  perform pg_temp.record('son auteur ne la traite pas', n = 0, n::text);

  perform pg_temp.act_as(v_editor);
  update public.guide_suggestions set status = 'resolved', resolution_note = 'Corrigé, merci.' where id = v_suggestion;
  v_err := null;
  begin
    update public.guide_suggestions set message = 'Message réécrit par l''équipe.' where id = v_suggestion;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('l''équipe traite la suggestion (statut, réponse, traitée par)',
    exists (select 1 from public.guide_suggestions where id = v_suggestion and status = 'resolved' and handled_by = v_editor));
  perform pg_temp.record('le message d''une suggestion ne se modifie pas', v_err = '42501', v_err);

  -- Dépublication : retiré de l'assistant et de l'historique public
  perform pg_temp.act_as(v_editor);
  perform public.save_guide_article(v_article, v_section, 'zqg-sante', 'Se soigner (test)', 'Résumé', 'Texte corrigé, assez long pour être valide.', 'draft', 'verified', v_source, 'Retrait temporaire');
  perform pg_temp.back();
  perform pg_temp.record('un article retiré quitte les documents de l''assistant',
    not exists (select 1 from public.knowledge_documents where entity_id = v_article));
  perform pg_temp.act_as(null);
  select count(*) into n from public.guide_article_history(v_article);
  perform pg_temp.back();
  perform pg_temp.record('l''historique d''un article non publié n''est pas public', n = 0, n::text);

  v_err := null;
  perform pg_temp.act_as(v_reader);
  begin
    insert into public.guide_suggestions (article_id, user_id, message) values (v_article, v_reader, 'Suggestion sur un article retiré.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('pas de suggestion sur un article non publié', v_err = '23514', v_err);
end $$;

select test, ok, detail from results order by n;
rollback;
