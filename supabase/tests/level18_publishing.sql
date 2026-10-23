-- =============================================================================
-- Niveau 18 : publication (brouillon incomplet, photos privées, doublons,
-- suggestions tracées, consommation de l'IA réservée au serveur).
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
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'auteur18@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre18@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur18@test.invalid', '{}', now(), now());
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000903';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_category uuid := (select id from public.categories where slug = 'maison-ameublement');
  v_author uuid := '00000000-0000-4000-8000-000000000901';
  v_other uuid := '00000000-0000-4000-8000-000000000902';
  v_moderator uuid := '00000000-0000-4000-8000-000000000903';
  v_hash text := repeat('ab', 32);
  v_draft uuid; v_other_listing uuid; v_image uuid; v_suggestion uuid; v_err text; n int; v_bucket text;
begin
  -- Brouillon incomplet, privé
  perform pg_temp.act_as(v_author);
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status)
  values (v_author, 'brouillon-zq18a', '', '', v_category, v_city, 'draft') returning id into v_draft;
  perform pg_temp.record('un brouillon peut être vide (titre, description)', v_draft is not null);
  v_err := null;
  begin
    update public.listings set status = 'pending' where id = v_draft;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('soumettre un brouillon incomplet est refusé', v_err = '23514', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_other);
  select count(*) into n from public.listings where id = v_draft;
  perform pg_temp.record('un brouillon est invisible pour un autre membre', n = 0, n::text);
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*) into n from public.listings where id = v_draft;
  perform pg_temp.record('un brouillon est invisible pour un visiteur', n = 0, n::text);
  perform pg_temp.back();

  -- Photos : privées d'office, limitées, protégées
  perform pg_temp.act_as(v_author);
  insert into public.images (owner_id, listing_id, storage_path, bucket, content_hash, byte_size, width, height)
  values (v_author, v_draft, v_author || '/annonces/' || v_draft || '/a.jpg', 'media', v_hash, 1000, 1200, 900) returning id, bucket into v_image, v_bucket;
  perform pg_temp.record('une photo d''annonce déposée par l''auteur est privée d''office', v_bucket = 'private-media', v_bucket);
  v_err := null;
  begin
    update public.images set bucket = 'media' where id = v_image;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('l''auteur ne peut pas rendre sa photo publique lui-même', v_err = '42501', v_err);
  update public.images set alt_text = 'Table vue de face' where id = v_image;
  perform pg_temp.record('l''auteur peut légender sa photo', (select alt_text from public.images where id = v_image) = 'Table vue de face');
  for i in 2..10 loop
    insert into public.images (owner_id, listing_id, storage_path) values (v_author, v_draft, v_author || '/annonces/' || v_draft || '/' || i || '.jpg');
  end loop;
  v_err := null;
  begin
    insert into public.images (owner_id, listing_id, storage_path) values (v_author, v_draft, v_author || '/annonces/' || v_draft || '/11.jpg');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('dix photos au plus par annonce', v_err = '23514', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_other);
  select count(*) into n from public.images where listing_id = v_draft;
  perform pg_temp.record('les photos d''un brouillon sont invisibles pour les autres', n = 0, n::text);
  -- Doublon : même photo dans l'annonce d'un autre compte
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status)
  values (v_other, 'brouillon-zq18b', '', '', v_category, v_city, 'draft') returning id into v_other_listing;
  insert into public.images (owner_id, listing_id, storage_path, content_hash) values (v_other, v_other_listing, v_other || '/annonces/' || v_other_listing || '/b.jpg', v_hash);
  select other_matches into n from public.listing_image_duplicates(v_other_listing);
  perform pg_temp.record('une photo reprise d''un autre compte est repérée', n = 1, n::text);
  select count(*) into n from public.listing_image_duplicates(v_draft);
  perform pg_temp.record('on ne consulte pas les doublons de l''annonce d''un autre', n = 0, n::text);
  perform pg_temp.back();

  -- Suggestions tracées
  perform pg_temp.act_as(v_author);
  insert into public.listing_suggestions (listing_id, field, value, origin, input_kind, confidence, excerpt, status)
  values (v_draft, 'price', '25000'::jsonb, 'ia', 'texte', 0.8, '25 000 F', 'acceptee') returning id into v_suggestion;
  perform pg_temp.record('une suggestion naît toujours « proposée »', (select status from public.listing_suggestions where id = v_suggestion) = 'proposee');
  v_err := null;
  begin
    update public.listing_suggestions set value = '99'::jsonb where id = v_suggestion;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('la valeur d''une suggestion ne se modifie pas', v_err = '42501', v_err);
  update public.listing_suggestions set status = 'acceptee', previous_value = 'null'::jsonb where id = v_suggestion;
  perform pg_temp.record('accepter une suggestion date la décision', (select decided_at is not null and status = 'acceptee' from public.listing_suggestions where id = v_suggestion));
  update public.listing_suggestions set status = 'annulee', previous_value = '1'::jsonb where id = v_suggestion;
  perform pg_temp.record('annuler conserve la valeur d''avant', (select status = 'annulee' and previous_value = 'null'::jsonb from public.listing_suggestions where id = v_suggestion));
  v_err := null;
  begin
    update public.listing_suggestions set status = 'acceptee' where id = v_suggestion;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une suggestion annulée ne se réaccepte pas', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_other);
  select count(*) into n from public.listing_suggestions where listing_id = v_draft;
  perform pg_temp.record('les suggestions sont privées', n = 0, n::text);
  v_err := null;
  begin
    insert into public.listing_suggestions (listing_id, field, value, origin, input_kind, confidence) values (v_draft, 'title', '"x"', 'regles', 'texte', 0.5);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('on ne propose rien sur l''annonce d''un autre', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_moderator);
  select count(*) into n from public.listing_suggestions where listing_id = v_draft;
  perform pg_temp.record('la modération voit la trace des suggestions', n = 1, n::text);
  perform pg_temp.back();

  -- Consommation de l'IA : serveur seulement
  perform pg_temp.act_as(v_author);
  v_err := null;
  begin
    insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens, cost_usd) values (v_author, 'publication', 'x', 1, 1, 0);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre n''écrit pas la consommation de l''IA', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.ai_month_cost();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre ne lit pas le coût de l''IA', v_err = '42501', v_err);
  perform pg_temp.back();

  -- Soumission complète puis publication par l'équipe
  perform pg_temp.act_as(v_author);
  update public.listings set title = 'Table en bois massif', description = 'Table en bois massif, six places, très bon état.', location = 'SRID=4326;POINT(-6.6363 4.7485)', location_precision = 'approximate'
  where id = v_draft;
  update public.listings set status = 'pending' where id = v_draft;
  perform pg_temp.record('un brouillon complet se soumet', (select status from public.listings where id = v_draft) = 'pending');
  perform pg_temp.record('l''auteur lit sa position privée', (select count(*) from public.listing_editor_point(v_draft)) = 1);
  perform pg_temp.back();
  perform pg_temp.act_as(v_other);
  perform pg_temp.record('personne d''autre ne lit la position privée', (select count(*) from public.listing_editor_point(v_draft)) = 0);
  perform pg_temp.back();
  perform pg_temp.act_as(v_moderator);
  update public.images set bucket = 'media' where id = v_image;
  update public.listings set status = 'published' where id = v_draft;
  perform pg_temp.back();
  perform pg_temp.record('la modération publie l''annonce et ses photos', (select status from public.listings where id = v_draft) = 'published' and (select bucket from public.images where id = v_image) = 'media');
  perform pg_temp.record('l''auteur est notifié de la publication', exists (select 1 from public.notifications where user_id = v_author and title like 'Annonce publiée : Table en bois massif'));
end $$;

select test, ok, detail from results order by n;
rollback;
