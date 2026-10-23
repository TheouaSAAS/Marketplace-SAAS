-- =============================================================================
-- Niveau 20 : tableau de bord (confidentialité appliquée au site public,
-- notifications par catégorie, statistiques et historique des annonces).
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
  ('00000000-0000-4000-8000-000000002001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur20@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'curieux20@test.invalid', '{}', now(), now(), now());
update public.profiles set display_name = 'Zqd Vendeur' where id = '00000000-0000-4000-8000-000000002001';
update public.profiles set display_name = 'Zqd Curieux', created_at = now() - interval '30 days' where id = '00000000-0000-4000-8000-000000002002';

insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
values ('00000000-0000-4000-8000-000000002001', 'zqd-table', 'Zqd Table en bois', 'Table en bois massif, six places, bon état.',
        (select id from public.categories where slug = 'maison-ameublement'), (select id from public.cities where is_default), 'published',
        'SRID=4326;POINT(-6.6363 4.7485)', 'approximate');

do $$
declare
  v_seller uuid := '00000000-0000-4000-8000-000000002001';
  v_other uuid := '00000000-0000-4000-8000-000000002002';
  v_listing uuid := (select id from public.listings where slug = 'zqd-table');
  v_text text; v_ts timestamptz; v_count bigint; n int; v_bool boolean;
begin
  insert into public.listing_comments (listing_id, author_id, body) values (v_listing, v_other, 'Est-elle toujours disponible ?');

  -- Par défaut : comme avant (nom, ancienneté, nombre d'annonces visibles)
  perform pg_temp.act_as(null);
  select display_name, member_since, active_listings into v_text, v_ts, v_count from public.listing_seller(v_listing);
  perform pg_temp.record('par défaut, le nom du vendeur est public', v_text = 'Zqd Vendeur', v_text);
  perform pg_temp.record('par défaut, l''ancienneté et le nombre d''annonces sont publics', v_ts is not null and v_count = 1);
  perform pg_temp.back();

  -- Le vendeur masque son nom, son ancienneté, son nombre d'annonces et l'indexation
  perform pg_temp.act_as(v_seller);
  update public.user_preferences set show_public_name = false, show_member_since = false, show_listing_count = false, search_indexing = false
  where user_id = v_seller;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select display_name, member_since, active_listings into v_text, v_ts, v_count from public.listing_seller(v_listing);
  perform pg_temp.record('nom masqué : « Membre » sur l''annonce', v_text = 'Membre', v_text);
  perform pg_temp.record('ancienneté et nombre d''annonces masqués', v_ts is null and v_count is null);
  perform pg_temp.record('indexation refusée : lisible par le site public', not public.member_allows_indexing(v_seller));
  perform pg_temp.record('indexation acceptée par défaut pour les autres', public.member_allows_indexing(v_other));
  perform pg_temp.back();

  -- Commentaire : le nom de l'auteur suit son choix
  perform pg_temp.act_as(null);
  select author_name into v_text from public.listing_comment_thread(v_listing) limit 1;
  perform pg_temp.record('commentaire : nom public par défaut', v_text = 'Zqd Curieux', v_text);
  perform pg_temp.back();
  perform pg_temp.act_as(v_other);
  update public.user_preferences set show_public_name = false where user_id = v_other;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select author_name into v_text from public.listing_comment_thread(v_listing) limit 1;
  perform pg_temp.record('commentaire : nom masqué à la demande de l''auteur', v_text = 'Membre', v_text);
  perform pg_temp.back();

  -- Préférences privées
  perform pg_temp.act_as(v_other);
  select count(*) into n from public.user_preferences where user_id = v_seller;
  perform pg_temp.record('on ne lit pas les préférences d''un autre', n = 0, n::text);
  perform pg_temp.record('member_privacy n''est pas appelable directement',
    not has_function_privilege('authenticated', 'public.member_privacy(uuid)', 'execute'));
  perform pg_temp.back();

  -- Notifications : une catégorie coupée n'est plus envoyée, l'essentiel si
  perform pg_temp.act_as(v_seller);
  update public.user_preferences set notification_channels = '{"avis": {"site": false}}' where user_id = v_seller;
  perform pg_temp.back();
  insert into public.notifications (user_id, type, title) values (v_seller, 'avis', 'Zqd nouvel avis');
  insert into public.notifications (user_id, type, title) values (v_seller, 'annonce', 'Zqd annonce publiée');
  perform pg_temp.record('une catégorie coupée n''est plus notifiée', not exists (select 1 from public.notifications where user_id = v_seller and title = 'Zqd nouvel avis'));
  perform pg_temp.record('les décisions de modération restent notifiées', exists (select 1 from public.notifications where user_id = v_seller and title = 'Zqd annonce publiée'));

  -- Statistiques et historique : l'auteur seulement
  insert into public.listing_view_counts (listing_id, views) values (v_listing, 12);
  insert into public.favorites (user_id, listing_id) values (v_other, v_listing);
  perform pg_temp.act_as(v_seller);
  perform pg_temp.record('l''auteur voit vues et favoris de son annonce',
    (select views = 12 and favorites = 1 from public.my_listing_stats() where listing_id = v_listing));
  update public.listings set availability_status = 'unavailable' where id = v_listing;
  update public.listings set status = 'archived' where id = v_listing;
  select count(*) into n from public.my_listing_history(v_listing);
  perform pg_temp.record('l''historique garde les changements de statut et de disponibilité', n >= 2, n::text);
  perform pg_temp.record('archiver une annonce publiée est possible pour l''auteur', (select status from public.listings where id = v_listing) = 'archived');
  perform pg_temp.back();
  perform pg_temp.act_as(v_other);
  select count(*) into n from public.my_listing_stats() where listing_id = v_listing;
  perform pg_temp.record('un autre membre ne voit pas ces statistiques', n = 0, n::text);
  select count(*) into n from public.my_listing_history(v_listing);
  perform pg_temp.record('ni cet historique', n = 0, n::text);
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
