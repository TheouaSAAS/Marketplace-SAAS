-- =============================================================================
-- Avant le niveau 28 : rubriques des annonces administrables (arborescence à
-- quatre niveaux, suppression avec reprise des contenus) et « Toutes les
-- annonces » (recherche multi-rubriques et filtres de caractéristiques).
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
create function pg_temp.point() returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography
$$;
create function pg_temp.cat(p_slug text) returns uuid language sql as $$
  select id from public.categories where slug = p_slug
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000002801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur28@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002802', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin28@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002802';

-- Référentiel livré (étapes C et D)
do $$
declare n int;
begin
  select count(*) into n from public.categories c join public.categories p on p.id = c.parent_id
  where p.slug = 'annonces-biens' and c.is_active;
  perform pg_temp.record('Biens et objets : neuf sous-rubriques', n = 9, n::text);
  select count(*) into n from public.categories c join public.categories p on p.id = c.parent_id
  where p.slug = 'vehicules' and c.is_active;
  perform pg_temp.record('Véhicules : six sous-rubriques', n = 6, n::text);
  select count(*) into n from public.categories where slug in ('meubles', 'electromenager', 'telephones-smartphones', 'televiseurs', 'vetements', 'outils',
    'materiel-sport', 'jouets', 'materiel-agricole', 'citadines-berlines', 'suv-4x4', 'scooters', 'camions', 'engins-chantier', 'pneus-jantes', 'autres-vehicules');
  perform pg_temp.record('les sous-catégories demandées existent', n = 16, n::text);
  select count(*) into n from public.categories where slug in ('pieces-automobiles', 'pieces-moto', 'pneus-jantes', 'accessoires-equipement-auto') and attribute_schema = 'piece';
  perform pg_temp.record('les pièces ont leur propre fiche (pas de kilométrage imposé)', n = 4, n::text);
  select count(*) into n from public.categories where slug in ('citadines-berlines', 'suv-4x4', 'pick-up', 'voitures-familiales', 'camions') and attribute_schema = 'vehicule';
  perform pg_temp.record('les véhicules complets ont la fiche véhicule', n = 5, n::text);
  select count(*) into n from public.categories where slug in ('meubles', 'jouets', 'outils') and attribute_schema = 'bien';
  perform pg_temp.record('les objets ont la fiche bien (état, marque)', n = 3, n::text);
end $$;

-- A. Arborescence protégée
do $$
declare
  v_admin uuid := '00000000-0000-4000-8000-000000002802';
  v_level4 uuid; v_err text;
begin
  insert into public.categories (parent_id, family, content_types, attribute_schema, slug, name, sort_order)
  values (pg_temp.cat('citadines-berlines'), 'trouver', '{listing}', 'vehicule', 'zq-niveau-4', 'Zq Niveau 4', 1)
  returning id into v_level4;
  perform pg_temp.record('une catégorie détaillée (4e niveau) s''ajoute', v_level4 is not null);

  v_err := null;
  begin
    insert into public.categories (parent_id, family, content_types, slug, name) values (v_level4, 'trouver', '{listing}', 'zq-niveau-5', 'Zq Niveau 5');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('pas de cinquième niveau', v_err = '23514', v_err);

  v_err := null;
  begin
    update public.categories set parent_id = id where slug = 'meubles';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une catégorie n''est pas sa propre parente', v_err = '23514', v_err);

  v_err := null;
  begin
    update public.categories set parent_id = pg_temp.cat('voitures') where slug = 'vehicules';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('pas de cycle (rubrique déplacée sous sa descendante)', v_err = '23514', v_err);

  v_err := null;
  begin
    update public.categories set parent_id = (select id from public.categories where family = 'decouvrir' and parent_id is null limit 1) where slug = 'meubles';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('pas de déplacement vers une autre famille', v_err = '23514', v_err);

  v_err := null;
  begin
    update public.categories set parent_id = pg_temp.cat('meubles') where slug = 'voitures';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un déplacement ne pousse pas les sous-catégories au-delà de quatre niveaux', v_err = '23514', v_err);

  update public.categories set parent_id = pg_temp.cat('maison-ameublement') where slug = 'jouets';
  perform pg_temp.record('un déplacement valide est accepté', (select parent_id from public.categories where slug = 'jouets') = pg_temp.cat('maison-ameublement'));
end $$;

-- A. Suppression avec reprise des contenus
do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_seller uuid := '00000000-0000-4000-8000-000000002801';
  v_admin uuid := '00000000-0000-4000-8000-000000002802';
  v_old uuid; v_listing uuid; v_err text; n int;
begin
  insert into public.categories (parent_id, family, content_types, attribute_schema, slug, name, sort_order)
  values (pg_temp.cat('meubles'), 'trouver', '{listing}', 'bien', 'zq-a-supprimer', 'Zq À supprimer', 1)
  returning id into v_old;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location_precision)
  values (v_seller, 'zqs-armoire', 'Zqs Armoire', repeat('Description de test. ', 3), v_old, v_city, 'draft', 'unknown')
  returning id into v_listing;

  perform pg_temp.act_as(v_seller);
  v_err := null;
  begin
    perform public.delete_category(v_old, pg_temp.cat('decoration'), 'Doublon de catégorie');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('seul un administrateur supprime une catégorie', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.admin_category_usage();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni ne consulte l''utilisation des catégories', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_admin);
  select listings_other into n from public.admin_category_usage() where category_id = v_old;
  perform pg_temp.record('l''administration voit les annonces rattachées', n = 1, coalesce(n::text, 'null'));
  select children into n from public.admin_category_usage() where category_id = pg_temp.cat('annonces-biens');
  perform pg_temp.record('et le nombre de sous-catégories', n = 9, coalesce(n::text, 'null'));

  v_err := null;
  begin
    perform public.delete_category(v_old, null, 'Doublon de catégorie');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une catégorie utilisée ne se supprime pas sans reprise', v_err = '23514', v_err);
  v_err := null;
  begin
    perform public.delete_category(pg_temp.cat('voitures'), pg_temp.cat('motos'), 'Réorganisation');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni une catégorie qui a des sous-catégories', v_err = '23514', v_err);
  v_err := null;
  begin
    perform public.delete_category(v_old, pg_temp.cat('decoration'), 'ok');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('la raison est obligatoire', v_err = '23514', v_err);
  v_err := null;
  begin
    perform public.delete_category(v_old, (select id from public.categories where family = 'decouvrir' limit 1), 'Doublon de catégorie');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('la reprise se fait dans la même famille', v_err = '23514', v_err);

  n := public.delete_category(v_old, pg_temp.cat('decoration'), 'Doublon de catégorie');
  perform pg_temp.back();
  perform pg_temp.record('la suppression déplace les contenus', n = 1, n::text);
  perform pg_temp.record('l''annonce garde son contenu, dans la catégorie de reprise',
    (select category_id = pg_temp.cat('decoration') and title = 'Zqs Armoire' from public.listings where id = v_listing));
  perform pg_temp.record('la catégorie a disparu', not exists (select 1 from public.categories where id = v_old));
  perform pg_temp.record('la suppression est journalisée',
    exists (select 1 from public.admin_audit_log where action = 'categorie.suppression' and entity_id = v_old and actor_id = v_admin));
end $$;

-- B. Toutes les annonces : visibilité et filtres
do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_seller uuid := '00000000-0000-4000-8000-000000002801';
  v_fridge uuid; v_cheap uuid; v_pending uuid; v_job uuid; v_car uuid;
  v_ids uuid[]; n int;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, price, attributes, published_at)
  values (v_seller, 'zqb-frigo', 'Zqb Réfrigérateur Samsung', repeat('Description de test. ', 3), pg_temp.cat('electromenager'), v_city, 'published', pg_temp.point(), 'exact', 150000,
          '{"etat": "bon", "marque": "Samsung"}', now() - interval '1 hour')
  returning id into v_fridge;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, price, attributes, published_at)
  values (v_seller, 'zqb-ventilateur', 'Zqb Ventilateur', repeat('Description de test. ', 3), pg_temp.cat('electromenager'), v_city, 'published', pg_temp.point(), 'exact', 20000,
          '{"etat": "neuf"}', now())
  returning id into v_cheap;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, price)
  values (v_seller, 'zqb-attente', 'Zqb Congélateur en attente', repeat('Description de test. ', 3), pg_temp.cat('electromenager'), v_city, 'pending', pg_temp.point(), 'exact', 90000)
  returning id into v_pending;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, price, attributes, published_at)
  values (v_seller, 'zqb-voiture', 'Zqb Toyota Corolla', repeat('Description de test. ', 3), pg_temp.cat('citadines-berlines'), v_city, 'published', pg_temp.point(), 'exact', 4500000,
          '{"marque": "Toyota", "annee": 2016, "kilometrage": 98000, "carburant": "essence"}', now())
  returning id into v_car;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision, published_at)
  values (v_seller, 'zqb-emploi', 'Zqb Offre de vendeur', repeat('Description de test. ', 3),
          (select id from public.categories where attribute_schema = 'emploi' and is_active limit 1), v_city, 'published', pg_temp.point(), 'exact', now())
  returning id into v_job;

  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_listings(p_query => 'zqb', p_limit => 60);
  perform pg_temp.record('toutes les rubriques sont agrégées (biens et véhicules)', v_fridge = any (v_ids) and v_car = any (v_ids), array_length(v_ids, 1)::text);
  perform pg_temp.record('une annonce en attente de modération reste invisible', not (v_pending = any (v_ids)));
  perform pg_temp.record('les offres d''emploi restent dans leur rubrique', not (v_job = any (v_ids)));

  select array_agg(id) into v_ids from public.search_listings(p_categories => array[pg_temp.cat('electromenager')], p_query => 'zqb');
  perform pg_temp.record('filtre par rubrique', array_length(v_ids, 1) = 2 and v_cheap = any (v_ids) and v_fridge = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_listings(p_categories => array[pg_temp.cat('electromenager')], p_query => 'zqb', p_sort => 'prix_desc');
  perform pg_temp.record('tri par prix décroissant', v_ids = array[v_fridge, v_cheap], v_ids::text);
  select array_agg(id) into v_ids from public.search_listings(p_query => 'zqb', p_price_max => 100000);
  perform pg_temp.record('filtre de prix', v_ids = array[v_cheap], v_ids::text);
  select array_agg(id) into v_ids from public.search_listings(p_query => 'zqb', p_eq => '{"etat": "bon"}');
  perform pg_temp.record('filtre d''état', v_ids = array[v_fridge], v_ids::text);
  select array_agg(id) into v_ids from public.search_listings(p_query => 'zqb', p_text => '{"marque": "SAMSUNG"}');
  perform pg_temp.record('marque sans casse', v_ids = array[v_fridge], v_ids::text);
  select array_agg(id) into v_ids from public.search_listings(p_query => 'zqb', p_min => '{"annee": 2015}', p_max => '{"kilometrage": 100000}');
  perform pg_temp.record('bornes année et kilométrage', v_ids = array[v_car], v_ids::text);
  select count(*) into n from public.search_listings(p_query => 'zqb', p_max => '{"kilometrage": 50000}');
  perform pg_temp.record('kilométrage trop élevé exclu', n = 0, n::text);
  select max(total_count) into n from public.search_listings(p_query => 'zqb', p_limit => 1);
  perform pg_temp.record('le total ignore la pagination', n = 3, n::text);
  perform pg_temp.back();

  update public.listings set status = 'archived' where id = v_fridge;
  perform pg_temp.act_as(null);
  select count(*) into n from public.search_listings(p_query => 'zqb') where id = v_fridge;
  perform pg_temp.record('une annonce retirée disparaît aussitôt', n = 0, n::text);
  perform pg_temp.back();
  update public.listings set published_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = v_cheap;
  perform pg_temp.act_as(null);
  select count(*) into n from public.search_listings(p_query => 'zqb') where id = v_cheap;
  perform pg_temp.record('une annonce expirée disparaît', n = 0, n::text);
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
