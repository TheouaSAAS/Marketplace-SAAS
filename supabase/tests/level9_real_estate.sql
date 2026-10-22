-- =============================================================================
-- Niveau 9 : recherche immobilière (attributs, séjour, budget, fraîcheur).
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon;
grant usage on sequence results_n_seq to anon;

create function pg_temp.record(p_test text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000091', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'immo9@test.invalid', '{}', now(), now());

insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision,
                             price, price_unit, attributes, availability_status)
select '00000000-0000-4000-8000-000000000091', v.slug, v.title, repeat('Description de test. ', 3),
       (select id from public.categories where slug = 'immobilier-location'), (select id from public.cities where is_default), 'published',
       extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact',
       v.price, v.unit::public.price_unit, v.attributes::jsonb, v.availability::public.availability_status
from (values
  ('i9-studio', 'Zqximmo studio meublé', 80000, 'par_mois', '{"type_bien":"studio","pieces":1,"meuble":true,"surface_m2":25,"equipements":["climatisation","parking"]}', 'available'),
  ('i9-maison', 'Zqximmo maison familiale', 250000, 'par_mois', '{"type_bien":"maison","pieces":5,"chambres":3,"meuble":false,"surface_m2":140}', 'unknown'),
  ('i9-nuit', 'Zqximmo appartement à la nuit', 20000, 'par_nuit', '{"type_bien":"appartement","pieces":2,"meuble":true}', 'available'),
  ('i9-bizarre', 'Zqximmo attributs mal typés', 90000, 'par_mois', '{"type_bien":"studio","pieces":"trois","meuble":"oui"}', 'unknown')
) as v(slug, title, price, unit, attributes, availability);
update public.listings set last_confirmed_at = now() - interval '2 days' where slug = 'i9-studio';
update public.listings set published_at = now() - interval '45 days' where slug = 'i9-maison';

create function pg_temp.found(p_args jsonb) returns text[] language sql as $$
  select coalesce(array_agg(l.slug order by l.slug), '{}')
  from public.search_real_estate(
    (select id from public.cities where is_default),
    array[(select id from public.categories where slug = 'immobilier-location')],
    p_stay => p_args ->> 'stay',
    p_query => 'zqximmo',
    p_type_bien => p_args ->> 'type',
    p_pieces_min => (p_args ->> 'pieces')::int,
    p_chambres_min => (p_args ->> 'chambres')::int,
    p_meuble => (p_args ->> 'meuble')::boolean,
    p_prix_max => (p_args ->> 'prix_max')::numeric,
    p_dispo => coalesce((p_args ->> 'dispo')::boolean, false),
    p_confirmed_days => (p_args ->> 'confirmed')::int,
    p_equipements => case when p_args ? 'equipements' then array(select jsonb_array_elements_text(p_args -> 'equipements')) end,
    p_limit => 50) r
  join public.listings l on l.id = r.id
$$;

set local role anon;
select pg_temp.record('séjour classique : exclut la location à la nuit', pg_temp.found('{"stay":"long"}') = '{i9-bizarre,i9-maison,i9-studio}', pg_temp.found('{"stay":"long"}')::text);
select pg_temp.record('séjour temporaire : seulement à la nuit ou à la journée', pg_temp.found('{"stay":"short"}') = '{i9-nuit}', pg_temp.found('{"stay":"short"}')::text);
select pg_temp.record('pièces minimum (valeur mal typée ignorée)', pg_temp.found('{"pieces":2}') = '{i9-maison,i9-nuit}', pg_temp.found('{"pieces":2}')::text);
select pg_temp.record('type et meublé', pg_temp.found('{"type":"studio","meuble":true}') = '{i9-studio}', pg_temp.found('{"type":"studio","meuble":true}')::text);
select pg_temp.record('budget maximal', pg_temp.found('{"prix_max":85000,"stay":"long"}') = '{i9-studio}', pg_temp.found('{"prix_max":85000,"stay":"long"}')::text);
select pg_temp.record('équipements : tous requis', pg_temp.found('{"equipements":["climatisation","parking"]}') = '{i9-studio}', pg_temp.found('{"equipements":["climatisation","parking"]}')::text);
select pg_temp.record('disponibles déclarées', pg_temp.found('{"dispo":true,"stay":"long"}') = '{i9-studio}', pg_temp.found('{"dispo":true,"stay":"long"}')::text);
select pg_temp.record('confirmées depuis moins de 30 jours', not ('i9-maison' = any (pg_temp.found('{"confirmed":30}'))), pg_temp.found('{"confirmed":30}')::text);
select pg_temp.record('chambres minimum', pg_temp.found('{"chambres":3}') = '{i9-maison}', pg_temp.found('{"chambres":3}')::text);
reset role;

select test, ok, detail from results order by n;
rollback;
