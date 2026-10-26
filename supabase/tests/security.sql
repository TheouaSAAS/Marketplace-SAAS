-- =============================================================================
-- Tests de sécurité exécutés sur la VRAIE base (npm run db:verify).
-- Tout se déroule dans une transaction annulée à la fin : aucune donnée ne
-- reste en base. Chaque vérification ajoute une ligne (test, ok, detail).
--
-- Simulation des rôles Supabase : `set local role anon|authenticated` +
-- `request.jwt.claims` (lu par auth.uid()).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);

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

-- -----------------------------------------------------------------------------
-- Jeu d'essai (en tant que postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proprio@test.invalid', '{"display_name":"Propriétaire Test"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre@test.invalid', '{"display_name":"A"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suspendu@test.invalid', '{}', now(), now());

update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-000000000004';

create temp table ctx as
select
  (select id from public.cities where slug = 'san-pedro') as city_id,
  (select id from public.categories where slug = 'immobilier-location') as cat_listing,
  (select id from public.categories where slug = 'restaurants-gastronomie') as cat_place_only,
  (select id from public.neighborhoods where slug = 'cite') as neighborhood_id;
grant select on ctx to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Profils
-- -----------------------------------------------------------------------------
select pg_temp.record('profil créé automatiquement à l''inscription, avec le nom fourni',
  (select display_name = 'Propriétaire Test' and role = 'user' from public.profiles where id = '00000000-0000-4000-8000-000000000001'));
select pg_temp.record('nom trop court ignoré sans bloquer l''inscription',
  (select display_name is null from public.profiles where id = '00000000-0000-4000-8000-000000000002'));

do $$
declare v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000001';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un utilisateur ne peut pas se promouvoir administrateur', v_err = '42501', v_err);
end $$;

do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  select count(*) into n from public.profiles where id = '00000000-0000-4000-8000-000000000002';
  perform pg_temp.back();
  perform pg_temp.record('un utilisateur ne lit pas le profil d''un autre', n = 0, n::text);
end $$;

-- -----------------------------------------------------------------------------
-- Référentiel public
-- -----------------------------------------------------------------------------
do $$
declare n_cities int; n_cat int; v_err text;
begin
  perform pg_temp.act_as(null);
  select count(*) into n_cities from public.cities;
  select count(*) into n_cat from public.categories;
  begin
    insert into public.cities (slug, name) values ('pirate', 'Pirate');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un visiteur lit les villes ouvertes', n_cities = 1, n_cities::text);
  perform pg_temp.record('un visiteur lit les catégories', n_cat > 30, n_cat::text);
  perform pg_temp.record('un visiteur ne peut pas créer de ville', v_err = '42501', v_err);
end $$;

-- -----------------------------------------------------------------------------
-- Cycle de vie d'une annonce
-- -----------------------------------------------------------------------------
do $$
declare v_err text;
begin
  perform pg_temp.act_as(null);
  begin
    insert into public.listings (owner_id, slug, title, description, category_id, city_id)
    select '00000000-0000-4000-8000-000000000001', 'anon-test', 'Titre suffisant', repeat('Description. ', 3), cat_listing, city_id from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un visiteur ne peut pas publier', v_err = '42501', v_err);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    insert into public.listings (owner_id, slug, title, description, category_id, city_id, status)
    select '00000000-0000-4000-8000-000000000001', 'auto-publiee', 'Annonce auto publiée', repeat('Description. ', 3), cat_listing, city_id, 'published' from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un auteur ne peut pas créer une annonce déjà publiée', v_err = '42501', v_err);
end $$;

do $$
declare v_views int; v_status text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, neighborhood_id, view_count, price, price_unit, location, location_precision)
  select '00000000-0000-4000-8000-000000000001', 'studio-test', 'Studio de test', repeat('Description de test. ', 3), cat_listing, city_id, neighborhood_id, 999, 100000, 'par_mois',
         extensions.st_setsrid(extensions.st_makepoint(-6.6311, 4.7512), 4326)::extensions.geography, 'exact'
  from ctx;
  select view_count, status into v_views, v_status from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('un brouillon est créé par son auteur', v_status = 'draft', v_status);
  perform pg_temp.record('un auteur ne peut pas gonfler son compteur de vues', v_views = 0, v_views::text);
end $$;

do $$
declare n_anon int; n_other int;
begin
  perform pg_temp.act_as(null);
  select count(*) into n_anon from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000002');
  select count(*) into n_other from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('un brouillon est invisible du public', n_anon = 0, n_anon::text);
  perform pg_temp.record('un brouillon est invisible des autres membres', n_other = 0, n_other::text);
end $$;

do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000002');
  update public.listings set title = 'Annonce détournée' where slug = 'studio-test';
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas modifier l''annonce d''un autre', n = 0, n::text);
end $$;

do $$
declare v_err text; v_status text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  update public.listings set status = 'pending' where slug = 'studio-test';
  begin
    update public.listings set status = 'published' where slug = 'studio-test';
  exception when others then v_err := sqlstate;
  end;
  select status into v_status from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('l''auteur soumet son annonce à la modération', v_status = 'pending', v_status);
  perform pg_temp.record('l''auteur ne peut pas se publier lui-même', v_err = '42501', v_err);
end $$;

do $$
declare v_err text; v_status text; v_pub timestamptz; v_exp timestamptz;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000003');
  begin
    update public.listings set status = 'rejected' where slug = 'studio-test';
  exception when others then v_err := sqlstate;
  end;
  update public.listings set status = 'published' where slug = 'studio-test';
  select status, published_at, expires_at into v_status, v_pub, v_exp from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('un rejet sans motif est refusé', v_err = '23514', v_err);
  perform pg_temp.record('la modération publie ; la date de publication est fixée', v_status = 'published' and v_pub is not null, v_status);
  perform pg_temp.record('l''échéance par défaut est de 60 jours',
    v_exp between now() + interval '59 days' and now() + interval '61 days', v_exp::text);
end $$;

do $$
declare n int;
begin
  perform pg_temp.act_as(null);
  select count(*) into n from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('une annonce publiée est visible du public', n = 1, n::text);
end $$;

do $$
declare v_status text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  update public.listings set title = 'Studio modifié après validation' where slug = 'studio-test';
  select status into v_status from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  perform pg_temp.record('modifier une annonce publiée la renvoie en vérification', v_status = 'pending', v_status);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    insert into public.listings (owner_id, slug, title, description, category_id, city_id)
    select '00000000-0000-4000-8000-000000000001', 'mauvaise-categorie', 'Annonce de test', repeat('Description. ', 3), cat_place_only, city_id from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('une catégorie inadaptée au type de contenu est refusée', v_err = '23503', v_err);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000004');
  begin
    insert into public.listings (owner_id, slug, title, description, category_id, city_id)
    select '00000000-0000-4000-8000-000000000004', 'suspendu', 'Annonce de test', repeat('Description. ', 3), cat_listing, city_id from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un compte suspendu ne peut pas publier', v_err = '42501', v_err);
end $$;

-- -----------------------------------------------------------------------------
-- Lieux
-- -----------------------------------------------------------------------------
do $$
declare v_err text; v_ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    insert into public.places (kind, created_by, slug, name, category_id, city_id)
    select 'lieu_touristique', '00000000-0000-4000-8000-000000000001', 'plage-pirate', 'Plage inventée', cat_place_only, city_id from ctx;
  exception when others then v_err := sqlstate;
  end;
  insert into public.places (kind, created_by, slug, name, category_id, city_id)
  select 'etablissement', '00000000-0000-4000-8000-000000000001', 'restaurant-test', 'Restaurant de test', cat_place_only, city_id from ctx;
  v_ok := true;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas créer de lieu touristique', v_err = '42501', v_err);
  perform pg_temp.record('un membre peut créer la fiche de son établissement', v_ok);
end $$;

-- -----------------------------------------------------------------------------
-- Interactions
-- -----------------------------------------------------------------------------
do $$
declare v_recipient uuid; v_err text;
begin
  -- Republication par la modération pour permettre le contact.
  update public.listings set status = 'published' where slug = 'studio-test';
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000002');
  insert into public.contact_requests (sender_id, recipient_id, listing_id, sender_name, sender_email, message)
  select '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', id, 'Autre membre', 'autre@test.invalid', 'Bonjour, ce studio est-il disponible ?'
  from public.listings where slug = 'studio-test';
  perform pg_temp.back();
  select recipient_id into v_recipient from public.contact_requests order by created_at desc limit 1;
  perform pg_temp.record('le destinataire d''un contact est imposé par la base (pas par le client)',
    v_recipient = '00000000-0000-4000-8000-000000000001', v_recipient::text);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    insert into public.contact_requests (sender_id, recipient_id, listing_id, sender_name, sender_email, message)
    select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', id, 'Moi', 'proprio@test.invalid', 'Message à moi-même pour test.'
    from public.listings where slug = 'studio-test';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('on ne peut pas se contacter soi-même', v_err = '23514', v_err);
end $$;

do $$
declare n_own int; n_other int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000002');
  insert into public.favorites (user_id, listing_id) select '00000000-0000-4000-8000-000000000002', id from public.listings where slug = 'studio-test';
  select count(*) into n_own from public.favorites;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  select count(*) into n_other from public.favorites;
  perform pg_temp.back();
  perform pg_temp.record('un membre voit ses favoris', n_own = 1, n_own::text);
  perform pg_temp.record('les favoris d''un membre sont privés', n_other = 0, n_other::text);
end $$;

-- -----------------------------------------------------------------------------
-- Monétisation et administration
-- -----------------------------------------------------------------------------
do $$
declare v_err text; v_err2 text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000001');
  begin
    insert into public.payments (user_id, subscription_id, amount_xof, provider, status, confirmed_at)
    values ('00000000-0000-4000-8000-000000000001', gen_random_uuid(), 1000, 'wave', 'succeeded', now());
  exception when others then v_err := sqlstate;
  end;
  begin
    perform public.log_admin_action('test', 'listing', null, '{}');
  exception when others then v_err2 := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas enregistrer un paiement (aucune transaction simulable)', v_err = '42501', v_err);
  perform pg_temp.record('un membre ne peut pas écrire dans le journal d''administration', v_err2 = '42501', v_err2);
end $$;

do $$
declare v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000003');
  perform public.log_admin_action('listing.publish', 'listing', null, '{"raison":"test"}');
  begin
    perform public.expire_listings();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('la modération journalise ses actions',
    exists (select 1 from public.admin_audit_log where action = 'listing.publish' and actor_id = '00000000-0000-4000-8000-000000000003'));
  perform pg_temp.record('la tâche d''expiration est réservée au système', v_err = '42501', v_err);
end $$;

-- -----------------------------------------------------------------------------
-- Stockage
-- -----------------------------------------------------------------------------
select pg_temp.record('bucket « media » : public, 5 Mo, images uniquement',
  (select public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg','image/png','image/webp']
   from storage.buckets where id = 'media'));

select test, ok, detail from results order by n;
rollback;
