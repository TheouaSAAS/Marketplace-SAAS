-- =============================================================================
-- Niveau 15 : carte (couches, zone, quartier, coordonnées publiables seulement).
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
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carte15@test.invalid', '{}', now(), now());

-- Trois annonces au même point exact, avec trois choix de confidentialité.
insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision,
                             public_location_precision, neighborhood_id)
select '00000000-0000-4000-8000-000000000601', v.slug, v.title, repeat('Description de test. ', 3),
       (select id from public.categories where slug = 'immobilier-location'), (select id from public.cities where is_default), 'published',
       extensions.st_setsrid(extensions.st_makepoint(-6.63123, 4.75123), 4326)::extensions.geography, 'exact',
       v.precision::public.public_location_precision, (select id from public.neighborhoods where slug = 'cite')
from (values ('m15-exacte', 'Zqm Annonce exacte', 'exact'), ('m15-approx', 'Zqm Annonce approximative', 'approximate'), ('m15-quartier', 'Zqm Annonce quartier seulement', 'neighborhood')) as v(slug, title, precision);

insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, location, location_precision)
select 'etablissement', '00000000-0000-4000-8000-000000000601', v.slug, v.name, (select id from public.categories where slug = 'alimentation'),
       (select id from public.cities where is_default), v.status::public.content_status, 'pending_validation',
       extensions.st_setsrid(extensions.st_makepoint(v.lng, 4.75), 4326)::extensions.geography, 'exact'
from (values ('m15-boutique', 'Zqm Boutique', 'published', -6.63), ('m15-loin', 'Zqm Boutique lointaine', 'published', -6.40), ('m15-archive', 'Zqm Boutique archivée', 'archived', -6.63)) as v(slug, name, status, lng);

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_all text[] := '{immobilier,emploi,services,commerces,tourisme,evenements}';
  v_err text; n int; v_lat double precision; v_lng double precision;
begin
  perform pg_temp.act_as(null);
  select lat, lng into v_lat, v_lng from public.map_features(v_city, v_all) where slug = 'm15-exacte';
  perform pg_temp.record('position exacte publiée si l''annonceur l''a choisie', v_lat = 4.75123 and v_lng = -6.63123, v_lat || ',' || v_lng);
  select lat, lng into v_lat, v_lng from public.map_features(v_city, v_all) where slug = 'm15-approx';
  perform pg_temp.record('position approximative : jamais le point exact', v_lat is not null and (v_lat <> 4.75123 or v_lng <> -6.63123), v_lat || ',' || v_lng);
  select count(*) into n from public.map_features(v_city, v_all) where slug = 'm15-quartier';
  perform pg_temp.record('« quartier seulement » : absente de la carte', n = 0, n::text);
  select count(*) into n from public.map_features(v_city, v_all) where slug = 'm15-archive';
  perform pg_temp.record('un contenu non publié n''apparaît pas', n = 0, n::text);
  select count(*) into n from public.map_features(v_city, '{commerces}') where slug like 'm15-%';
  perform pg_temp.record('filtre par couche', n = 2, n::text);
  select count(*) into n from public.map_features(v_city, v_all, -6.70, 4.70, -6.60, 4.80) where slug like 'm15-%';
  perform pg_temp.record('recherche par zone (la boutique lointaine est hors cadre)', n = 3, n::text);
  select count(*) into n from public.map_features(v_city, v_all, p_neighborhood => (select id from public.neighborhoods where slug = 'cite')) where slug like 'm15-%';
  perform pg_temp.record('recherche par quartier (relation réelle)', n = 2, n::text);
  begin
    select count(*) into n from public.listings where location is not null;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('la position exacte d''une annonce reste illisible pour le public', v_err = '42501', v_err);
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
