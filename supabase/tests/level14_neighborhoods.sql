-- =============================================================================
-- Niveau 14 : quartiers (périmètres en brouillon, validation, audit, ressources).
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


insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur14@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membre14@test.invalid', '{}', now(), now());
update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000000501';

insert into public.neighborhoods (city_id, slug, name) select id, 'q14-test', 'Zqn Quartier test' from public.cities where is_default;
insert into public.places (kind, created_by, slug, name, category_id, city_id, neighborhood_id, status, verification_status)
select 'etablissement', '00000000-0000-4000-8000-000000000501', v.slug, v.name, (select id from public.categories where slug = v.category),
       (select id from public.cities where is_default), (select id from public.neighborhoods where slug = 'q14-test'), 'published', 'pending_validation'
from (values ('q14-boutique', 'Zqn Boutique', 'alimentation'), ('q14-hotel', 'Zqn Hôtel', 'hotels-hebergements'), ('q14-plage', 'Zqn Plage', 'plages-sites-naturels')) as v(slug, name, category);

do $$
declare
  v_hood uuid := (select id from public.neighborhoods where slug = 'q14-test');
  v_editor uuid := '00000000-0000-4000-8000-000000000501';
  v_member uuid := '00000000-0000-4000-8000-000000000502';
  v_square text := '{"type":"Polygon","coordinates":[[[-6.640,4.745],[-6.630,4.745],[-6.630,4.752],[-6.640,4.752],[-6.640,4.745]]]}';
  v_square2 text := '{"type":"Polygon","coordinates":[[[-6.641,4.744],[-6.629,4.744],[-6.629,4.753],[-6.641,4.753],[-6.641,4.744]]]}';
  v_first uuid; v_second uuid; v_err text; v_text text; n int; v_ids uuid[];
begin
  perform pg_temp.act_as(null);
  perform pg_temp.record('un quartier existe sans périmètre', exists (select 1 from public.neighborhoods where id = v_hood and boundary is null));
  select count(*) into n from public.neighborhood_resource_counts(v_hood) where (kind, total) in (('commerces', 1), ('tourisme', 1), ('decouvrir', 1));
  perform pg_temp.record('ressources comptées par relation réelle au quartier', n = 3, n::text);
  select array_agg(id) into v_ids from public.search_tourism((select id from public.cities where is_default),
    array(select id from public.categories where slug in ('plages-sites-naturels', 'hotels-hebergements')), p_neighborhood => v_hood);
  perform pg_temp.record('filtre quartier dans la recherche touristique', cardinality(v_ids) = 2, v_ids::text);
  perform pg_temp.back();

  perform pg_temp.act_as(v_member);
  begin
    perform public.propose_neighborhood_boundary(v_hood, v_square);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne propose pas de périmètre', v_err = '42501', v_err);

  perform pg_temp.act_as(v_editor);
  v_err := null;
  begin
    perform public.propose_neighborhood_boundary(v_hood, '{"type":"LineString","coordinates":[[-6.64,4.745],[-6.63,4.75]]}');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un périmètre doit être un polygone', v_err = '23514', v_err);
  v_err := null;
  begin
    perform public.propose_neighborhood_boundary(v_hood, '{"type":"Polygon","coordinates":[[[-7.0,4.5],[-6.3,4.5],[-6.3,5.0],[-7.0,5.0],[-7.0,4.5]]]}');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un périmètre démesuré est refusé', v_err = '23514', v_err);
  v_err := null;
  begin
    update public.neighborhoods set boundary = extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(v_square), 4326))::extensions.geography where id = v_hood;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le périmètre publié ne se modifie pas directement', v_err = '42501', v_err);

  v_first := public.propose_neighborhood_boundary(v_hood, v_square, null, 'Relevé terrain');
  perform pg_temp.record('un brouillon ne publie rien', (select boundary is null from public.neighborhoods where id = v_hood));
  v_err := null;
  begin
    perform public.review_neighborhood_boundary(v_first, false, '');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un refus doit être motivé', v_err = '23514', v_err);
  perform public.review_neighborhood_boundary(v_first, true, 'Contrôlé sur place');
  v_second := public.propose_neighborhood_boundary(v_hood, v_square2, null, 'Correction');
  perform public.review_neighborhood_boundary(v_second, true, 'Correction validée');
  perform pg_temp.back();

  perform pg_temp.record('la validation publie le périmètre', (select boundary is not null and boundary_validated_at is not null from public.neighborhoods where id = v_hood));
  perform pg_temp.record('l''ancien périmètre est conservé comme « remplacé »',
    (select status from public.neighborhood_boundaries where id = v_first) = 'superseded' and (select status from public.neighborhood_boundaries where id = v_second) = 'validated');
  select count(*) into n from public.content_revisions where entity_id = v_hood and reason like 'Périmètre validé%';
  perform pg_temp.record('chaque publication de périmètre est historisée (avant / après)', n = 2, n::text);
  select count(*) into n from public.admin_audit_log where entity_id = v_hood and action like 'neighborhood_boundary.%';
  perform pg_temp.record('propositions et validations au journal d''administration', n = 4, n::text);

  perform pg_temp.act_as(null);
  v_text := public.neighborhood_boundary_geojson(v_hood);
  perform pg_temp.record('périmètre publié lisible en GeoJSON', v_text like '%MultiPolygon%', left(v_text, 40));
  select count(*) into n from public.neighborhood_boundaries;
  perform pg_temp.back();
  perform pg_temp.record('les brouillons ne sont pas publics', n = 0, n::text);

  perform pg_temp.act_as(v_editor);
  perform public.clear_neighborhood_boundary(v_hood, 'Limites contestées, à revoir');
  perform pg_temp.back();
  perform pg_temp.record('le retrait du périmètre est possible et tracé',
    (select boundary is null from public.neighborhoods where id = v_hood)
    and exists (select 1 from public.admin_audit_log where entity_id = v_hood and action = 'neighborhood_boundary.clear'));
end $$;

do $$
declare
  v_hood uuid := (select id from public.neighborhoods where slug = 'q14-test');
  v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000502');
  begin
    perform public.save_neighborhood(v_hood, 'Zqn Renommé', '{}', null, 'pending_validation', null, true, false, 'Essai');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne modifie pas une fiche quartier', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000501');
  perform public.save_neighborhood(v_hood, 'Zqn Quartier test', '{Zqn ancien nom}', 'Description neutre de test.', 'pending_validation', null, true, true, 'Ajout d''un nom alternatif');
  perform pg_temp.back();
  perform pg_temp.record('l''équipe locale modifie la fiche et se désigne responsable',
    exists (select 1 from public.neighborhoods where id = v_hood and alt_names = '{Zqn ancien nom}' and steward_id = '00000000-0000-4000-8000-000000000501'));
  perform pg_temp.record('la modification est historisée avec sa note',
    exists (select 1 from public.content_revisions where entity_id = v_hood and reason = 'Ajout d''un nom alternatif'));

  perform pg_temp.act_as(null);
  perform pg_temp.record('vue d''ensemble : contenus rattachés comptés en un appel',
    exists (select 1 from public.neighborhood_overview((select id from public.cities where is_default)) o where o.id = v_hood and o.total = 3 and not o.bounded));
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
