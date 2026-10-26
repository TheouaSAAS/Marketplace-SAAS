-- =============================================================================
-- Niveau 12 : tourisme (attributs, recherche, candidats d'itinéraire).
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
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur12@test.invalid', '{}', now(), now());
update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000000301';
insert into public.sources (kind, title, collected_at) values ('terrain', 'Zqt relevé terrain', current_date);

insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, verified_at, verified_by, source_id,
                           themes, audiences, visit_duration, price_level, accessibility, location, location_precision)
select v.kind::public.place_kind, '00000000-0000-4000-8000-000000000301', v.slug, v.name, (select id from public.categories where slug = v.category),
       (select id from public.cities where is_default), 'published', v.status::public.verification_status,
       case when v.status = 'verified' then now() end, case when v.status = 'verified' then '00000000-0000-4000-8000-000000000301'::uuid end,
       case when v.status = 'verified' then (select id from public.sources where title = 'Zqt relevé terrain') end,
       v.themes::text[], v.audiences::text[], v.duration, v.price, v.access::text[],
       extensions.st_setsrid(extensions.st_makepoint(-6.63 + v.dlng, 4.75), 4326)::extensions.geography, 'exact'
from (values
  ('lieu_touristique', 't12-plage', 'Zqtour Plage', 'plages-sites-naturels', 'pending_validation', '{plage,nature}', '{familles}', 'demi_journee', null::smallint, '{acces_voiture}', 0.01),
  ('lieu_touristique', 't12-musee', 'Zqtour Musée', 'lieux-a-visiter', 'verified', '{culture,histoire}', '{familles,seniors}', 'une_2h', 1::smallint, '{fauteuil_roulant}', 0.0),
  ('etablissement', 't12-guide', 'Zqtour Excursion', 'excursions-guides', 'pending_validation', '{nature}', '{groupes}', 'journee', 3::smallint, '{}', 0.05)
) as v(kind, slug, name, category, status, themes, audiences, duration, price, access, dlng);

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_cats uuid[] := array(select id from public.categories where slug in ('plages-sites-naturels', 'lieux-a-visiter', 'excursions-guides', 'loisirs-activites'));
  v_plage uuid := (select id from public.places where slug = 't12-plage');
  v_musee uuid := (select id from public.places where slug = 't12-musee');
  v_guide uuid := (select id from public.places where slug = 't12-guide');
  v_ids uuid[]; n int; v_err text;
begin
  perform pg_temp.record('catégorie « excursions, guides et opérateurs » ajoutée au référentiel',
    exists (select 1 from public.categories where slug = 'excursions-guides' and family = 'decouvrir'));
  begin
    update public.places set themes = '{inventé}' where id = v_plage;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un thème hors référentiel est refusé', v_err = '23514', v_err);

  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour');
  perform pg_temp.record('la fiche vérifiée passe devant', v_ids[1] = v_musee, v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_themes => '{plage}');
  perform pg_temp.record('filtre thème', v_ids = array[v_plage], v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_audiences => '{seniors}');
  perform pg_temp.record('filtre public', v_ids = array[v_musee], v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_max_duration => 'demi_journee');
  perform pg_temp.record('filtre durée maximale (une journée exclue)', not v_guide = any (v_ids) and v_plage = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_budget_max => 1::smallint);
  perform pg_temp.record('filtre budget (budget inconnu exclu)', v_ids = array[v_musee], v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_accessibility => '{fauteuil_roulant}');
  perform pg_temp.record('filtre accessibilité', v_ids = array[v_musee], v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_verified_only => true);
  perform pg_temp.record('filtre vérifiés', v_ids = array[v_musee], v_ids::text);
  select array_agg(id) into v_ids from public.search_tourism(v_city, v_cats, 'zqtour', p_lat => 4.75, p_lng => -6.63, p_radius_m => 2000);
  perform pg_temp.record('filtre distance', not v_guide = any (v_ids) and v_musee = any (v_ids), v_ids::text);

  select count(*) into n from public.itinerary_candidates(v_city, v_cats) c where c.slug like 't12-%' and c.lat is not null;
  perform pg_temp.record('candidats d''itinéraire avec position', n = 3, n::text);
  perform pg_temp.back();

  update public.places set status = 'archived' where id = v_plage;
  perform pg_temp.act_as(null);
  select count(*) into n from public.itinerary_candidates(v_city, v_cats) c where c.id = v_plage;
  perform pg_temp.back();
  perform pg_temp.record('un lieu retiré n''est jamais proposé en itinéraire', n = 0, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
