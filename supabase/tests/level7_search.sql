-- =============================================================================
-- Niveau 7 : moteur de recherche — correspondance, filtres, tri, visibilité,
-- statistiques anonymes et recherches enregistrées.
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
create function pg_temp.pt(p_lng double precision, p_lat double precision) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000071', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chercheur@test.invalid', '{}', now(), now());

create temp table ctx as
select c.id as city_id,
       (select id from public.categories where slug = 'immobilier-location') as cat_rent,
       (select id from public.categories where slug = 'concerts-spectacles') as cat_event
from public.cities c where c.is_default;
grant select on ctx to anon, authenticated;

-- Contenus de test (identifiables par leur titre « Zqx… » : aucun contenu réel ne les contient).
insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, price, price_unit,
                             location, location_precision, public_location_precision, published_at, expires_at)
select '00000000-0000-4000-8000-000000000071', v.slug, v.title, repeat('Description de test. ', 3), cat_rent, city_id, v.status::public.content_status,
       v.price, 'par_mois', pg_temp.pt(v.lng, v.lat), 'exact', 'exact', v.published_at, v.expires_at
from ctx, (values
  ('zqx-studio', 'Zqxstudio meublé lumineux', 'published', 80000, -6.6311, 4.7512, now() - interval '2 days', now() + interval '30 days'),
  ('zqx-appart', 'Zqxappartement trois pièces', 'published', 200000, -6.7000, 4.8000, now() - interval '1 day', now() + interval '30 days'),
  ('zqx-brouillon', 'Zqxstudio brouillon', 'draft', 50000, -6.6311, 4.7512, null, null),
  ('zqx-expire', 'Zqxstudio expiré', 'published', 50000, -6.6311, 4.7512, now() - interval '20 days', now() - interval '1 day')
) as v(slug, title, status, price, lng, lat, published_at, expires_at);
-- La publication repousse une échéance passée : l'annonce expire ensuite, comme dans la réalité.
update public.listings set published_at = now() - interval '20 days', expires_at = now() - interval '1 day' where slug = 'zqx-expire';

insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, ends_at, status)
select '00000000-0000-4000-8000-000000000071', v.slug, v.title, repeat('Description de test. ', 3), cat_event, city_id, v.starts_at, v.ends_at, 'published'
from ctx, (values
  ('zqx-passe', 'Zqxconcert passé', now() - interval '3 days', now() - interval '2 days'),
  ('zqx-bientot', 'Zqxconcert bientôt', now() + interval '2 days', null),
  ('zqx-loin', 'Zqxconcert lointain', now() + interval '40 days', null)
) as v(slug, title, starts_at, ends_at);

create temp table found (label text, slugs text[], total bigint);
grant all on found to anon, authenticated;

create function pg_temp.find(p_label text, p_type text, p_query text, p_args jsonb default '{}') returns void language plpgsql as $$
declare v_slugs text[]; v_total bigint;
begin
  select array_agg(coalesce(l.slug, e.slug) order by s.ord), max(s.total_count)
    into v_slugs, v_total
  from (
    select r.*, row_number() over () as ord
    from public.search_content(
      p_type, (select city_id from ctx), p_query,
      p_price_max => (p_args ->> 'price_max')::numeric,
      p_starts_from => (p_args ->> 'from')::timestamptz,
      p_starts_to => (p_args ->> 'to')::timestamptz,
      p_lat => (p_args ->> 'lat')::double precision,
      p_lng => (p_args ->> 'lng')::double precision,
      p_radius_m => (p_args ->> 'radius')::integer,
      p_sort => coalesce(p_args ->> 'sort', 'pertinence'),
      p_limit => 50) r
  ) s
  left join public.listings l on l.id = s.id
  left join public.events e on e.id = s.id;
  insert into found values (p_label, coalesce(array_remove(v_slugs, null), '{}'), coalesce(v_total, 0));
end $$;

do $$
begin
  perform pg_temp.act_as(null);
  perform pg_temp.find('studio', 'annonces', 'zqxstudio');
  perform pg_temp.find('accents', 'annonces', 'ZQXSTUDIO MEUBLE');
  perform pg_temp.find('faute', 'annonces', 'zqxapartement');
  perform pg_temp.find('prix', 'annonces', 'zqx', '{"price_max": 100000}');
  perform pg_temp.find('prix-desc', 'annonces', null, '{"sort": "prix_desc"}');
  perform pg_temp.find('rayon', 'annonces', null, '{"lat": 4.7512, "lng": -6.6311, "radius": 2000, "sort": "proximite"}');
  perform pg_temp.find('rayon-sans-position', 'annonces', 'zqx', '{"radius": 2000}');
  perform pg_temp.find('evenements', 'evenements', 'zqxconcert');
  perform pg_temp.find('periode', 'evenements', 'zqxconcert', jsonb_build_object('from', now(), 'to', now() + interval '7 days'));
  perform pg_temp.back();

  -- L'auteur connecté ne voit pas non plus ses brouillons dans la recherche.
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000071');
  perform pg_temp.find('auteur', 'annonces', 'zqxstudio');
  perform pg_temp.back();
end $$;

do $$
declare r record; v_count bigint; v_err text; v_stats int; v_norm text; v_n int;
begin
  select * into r from found where label = 'studio';
  perform pg_temp.record('mot-clé : seule l''annonce publiée et active est trouvée (ni brouillon, ni expirée)', r.slugs = '{zqx-studio}', r.slugs::text);
  select * into r from found where label = 'accents';
  perform pg_temp.record('insensible aux accents et à la casse', r.slugs = '{zqx-studio}', r.slugs::text);
  select * into r from found where label = 'faute';
  perform pg_temp.record('tolère une faute de frappe sur le titre', 'zqx-appart' = any (r.slugs), r.slugs::text);
  select * into r from found where label = 'prix';
  perform pg_temp.record('filtre de prix maximal', r.slugs = '{zqx-studio}', r.slugs::text);
  select * into r from found where label = 'prix-desc';
  perform pg_temp.record('tri par prix décroissant', array_position(r.slugs, 'zqx-appart') < array_position(r.slugs, 'zqx-studio'), r.slugs::text);
  select * into r from found where label = 'rayon';
  perform pg_temp.record('rayon de 2 km autour d''une position', 'zqx-studio' = any (r.slugs) and not ('zqx-appart' = any (r.slugs)), r.slugs::text);
  select * into r from found where label = 'rayon-sans-position';
  perform pg_temp.record('sans position, le rayon est ignoré', r.slugs @> '{zqx-studio,zqx-appart}', r.slugs::text);
  select * into r from found where label = 'evenements';
  perform pg_temp.record('un événement terminé n''apparaît jamais', r.slugs = '{zqx-bientot,zqx-loin}', r.slugs::text);
  select * into r from found where label = 'periode';
  perform pg_temp.record('filtre de période sur les événements', r.slugs = '{zqx-bientot}', r.slugs::text);
  select * into r from found where label = 'auteur';
  perform pg_temp.record('la recherche ignore les brouillons, même pour leur auteur', r.slugs = '{zqx-studio}', r.slugs::text);

  perform pg_temp.act_as(null);
  select total into v_count from public.search_counts((select city_id from ctx), 'zqxstudio') where type = 'annonces';
  perform pg_temp.back();
  perform pg_temp.record('les compteurs par type concordent avec les résultats', v_count = 1, v_count::text);

  begin
    perform public.search_content('inconnu', (select city_id from ctx));
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un type de recherche inconnu est refusé', v_err = '22023', v_err);

  -- Statistiques : écriture réservée au serveur, lecture réservée à l'administration.
  v_err := null;
  perform pg_temp.act_as(null);
  begin
    perform public.record_search((select city_id from ctx), 'annonces', 'test', 1);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un visiteur ne peut pas écrire de statistique', v_err = '42501', v_err);

  perform public.record_search((select city_id from ctx), 'annonces', 'Studio Zqx 07 07 12 34 56 moi@test.ci', 0);
  perform public.record_search((select city_id from ctx), 'annonces', 'studio zqx 0707123456 autre@test.ci', 0);
  select query_norm, searches into v_norm, v_n from public.search_stats
   where city_id = (select city_id from ctx) and day = current_date and query_norm like 'studio zqx%';
  perform pg_temp.record('statistiques : numéros et e-mails masqués, totaux agrégés',
    v_norm = 'studio zqx [nombre] [e-mail]' and v_n = 2, v_norm || ' × ' || v_n);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000071');
  select count(*) into v_stats from public.search_stats;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne lit pas les statistiques', v_stats = 0, v_stats::text);

  -- Recherches enregistrées : 20 au plus par compte.
  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000071');
  insert into public.saved_searches (user_id, name, query)
  select '00000000-0000-4000-8000-000000000071', 'Recherche ' || g, jsonb_build_object('search', 'q=studio', 'version', 1)
  from generate_series(1, 20) g;
  begin
    insert into public.saved_searches (user_id, name, query) values ('00000000-0000-4000-8000-000000000071', 'De trop', '{"search": "q=x", "version": 1}');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('au plus 20 recherches enregistrées par compte', v_err = '23514', v_err);
end $$;

select test, ok, detail from results order by n;
rollback;
