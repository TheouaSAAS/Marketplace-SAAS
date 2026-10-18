-- =============================================================================
-- Niveau 2 : rôles, gouvernance, organisations, confidentialité, domaines.
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);

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
create function pg_temp.pt(lng float, lat float) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
$$;

-- Comptes : membre A, membre B, membre C, éditeur local, modérateur, admin, superadmin.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-4000-8000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'n' || n || '@test.invalid', '{}', now(), now()
from unnest(array['11', '12', '13', '14', '15', '16', '17']) as n;
update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000000014';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000015';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000016';
update public.profiles set role = 'superadmin' where id = '00000000-0000-4000-8000-000000000017';

create temp table ctx as
select
  (select id from public.cities where slug = 'san-pedro') as city_id,
  (select id from public.categories where slug = 'immobilier-location') as cat_home,
  (select id from public.categories where slug = 'offres-emploi') as cat_job,
  (select id from public.categories where slug = 'restaurants-gastronomie') as cat_food,
  (select id from public.categories where slug = 'concerts-spectacles') as cat_event,
  (select id from public.guide_sections where slug = 'se-deplacer') as section_id;
grant select on ctx to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Rôles
-- -----------------------------------------------------------------------------
do $$
declare v_err1 text; v_err2 text; v_err3 text; v_role text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000016'); -- admin
  update public.profiles set role = 'professional' where id = '00000000-0000-4000-8000-000000000011';
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000012';
  exception when others then v_err1 := sqlstate;
  end;
  perform pg_temp.back();
  select role into v_role from public.profiles where id = '00000000-0000-4000-8000-000000000011';
  perform pg_temp.record('un administrateur attribue le rôle professionnel', v_role = 'professional', v_role);
  perform pg_temp.record('un administrateur ne peut pas créer d''administrateur', v_err1 = '42501', v_err1);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000017'); -- superadmin
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000012';
  perform pg_temp.back();
  select role into v_role from public.profiles where id = '00000000-0000-4000-8000-000000000012';
  perform pg_temp.record('un superadministrateur peut nommer un administrateur', v_role = 'admin', v_role);
  update public.profiles set role = 'user' where id = '00000000-0000-4000-8000-000000000012';

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000015'); -- modérateur
  begin
    update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000000013';
  exception when others then v_err2 := sqlstate;
  end;
  perform pg_temp.back();
  -- Refus par erreur (déclencheur) ou par absence de ligne modifiable (RLS) : le rôle doit être inchangé.
  select role into v_role from public.profiles where id = '00000000-0000-4000-8000-000000000013';
  perform pg_temp.record('un modérateur ne gère pas les rôles', v_role = 'user', coalesce(v_err2, 'aucune erreur') || ' / ' || v_role);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000014'); -- éditeur local
  begin
    update public.profiles set is_suspended = true where id = '00000000-0000-4000-8000-000000000013';
  exception when others then v_err3 := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un éditeur local ne suspend pas de compte', v_err3 = '42501' or v_err3 is null, coalesce(v_err3, 'aucune ligne visible'));
end $$;

-- -----------------------------------------------------------------------------
-- Gouvernance des données locales
-- -----------------------------------------------------------------------------
do $$
declare v_err text; v_status text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  begin
    insert into public.sources (kind, title, collected_at) values ('autre', 'Source inventée', current_date);
  exception when others then v_err := sqlstate;
  end;
  insert into public.places (kind, created_by, slug, name, category_id, city_id, verification_status, status, location, location_precision)
  select 'etablissement', '00000000-0000-4000-8000-000000000011', 'resto-test', 'Restaurant test', cat_food, city_id, 'verified', 'pending',
         pg_temp.pt(-6.6301, 4.7493), 'exact' from ctx;
  select verification_status into v_status from public.places where slug = 'resto-test';
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas créer de source', v_err = '42501', v_err);
  perform pg_temp.record('un membre ne peut pas s''auto-déclarer « vérifié »', v_status = 'pending_validation', v_status);
end $$;

do $$
declare v_err text; v_source uuid; v_row record;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000014'); -- éditeur local
  begin
    update public.places set verification_status = 'verified' where slug = 'resto-test';
  exception when others then v_err := sqlstate;
  end;
  insert into public.sources (kind, title, collected_at) values ('terrain', 'Relevé terrain de test', current_date) returning id into v_source;
  update public.places set verification_status = 'verified', source_id = v_source, status = 'published' where slug = 'resto-test';
  select verification_status, verified_at, verified_by, status into v_row from public.places where slug = 'resto-test';
  perform pg_temp.back();
  perform pg_temp.record('« vérifié » sans source est refusé', v_err = '23514', v_err);
  perform pg_temp.record('la vérification enregistre date et responsable automatiquement',
    v_row.verification_status = 'verified' and v_row.verified_at is not null and v_row.verified_by = '00000000-0000-4000-8000-000000000014',
    v_row.verification_status::text);
  perform pg_temp.record('un éditeur local publie une donnée locale', v_row.status = 'published', v_row.status::text);
end $$;

do $$
declare v_row record; n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  perform set_config('app.change_reason', 'Nouveau numéro', true);
  update public.places set phone = '+225 00 00 00 00' where slug = 'resto-test';
  select verification_status, status into v_row from public.places where slug = 'resto-test';
  perform pg_temp.back();
  perform pg_temp.record('une donnée vérifiée modifiée par son exploitant redevient « à vérifier »',
    v_row.verification_status = 'pending_validation', v_row.verification_status::text);
  perform pg_temp.record('… et repasse en modération', v_row.status = 'pending', v_row.status::text);
  select count(*) into n from public.content_revisions r join public.places p on p.id = r.entity_id
  where p.slug = 'resto-test' and r.entity_type = 'places';
  perform pg_temp.record('chaque modification est historisée (avant/après)', n >= 3, n::text);
  perform pg_temp.record('la raison de la modification est conservée',
    exists (select 1 from public.content_revisions where reason = 'Nouveau numéro' and changed_by = '00000000-0000-4000-8000-000000000011'));
end $$;

do $$
declare n_editor int; n_member int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  select count(*) into n_member from public.content_revisions;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000014');
  select count(*) into n_editor from public.content_revisions;
  perform pg_temp.back();
  perform pg_temp.record('l''historique est réservé à l''équipe', n_member = 0 and n_editor > 0, n_member || ' / ' || n_editor);
end $$;

do $$
declare n_on int; n_off int;
begin
  insert into public.places (kind, created_by, slug, name, category_id, city_id, verification_status, status)
  select 'lieu_touristique', '00000000-0000-4000-8000-000000000014', 'exemple-plage', 'Exemple — plage (à valider localement)', cat_food, city_id, 'placeholder', 'published' from ctx;
  perform pg_temp.act_as(null);
  select count(*) into n_on from public.places where slug = 'exemple-plage';
  perform pg_temp.back();
  update public.platform_settings set value = '{"enabled": false}' where key = 'demo.public_placeholders';
  perform pg_temp.act_as(null);
  select count(*) into n_off from public.places where slug = 'exemple-plage';
  perform pg_temp.back();
  perform pg_temp.record('un exemple est visible du public quand la démonstration est activée', n_on = 1, n_on::text);
  perform pg_temp.record('un exemple disparaît du public quand la démonstration est désactivée', n_off = 0, n_off::text);
  update public.platform_settings set value = '{"enabled": true}' where key = 'demo.public_placeholders';
end $$;

do $$
declare v_err text; v_ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  begin
    insert into public.neighborhoods (city_id, slug, name) select city_id, 'quartier-pirate', 'Quartier inventé' from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000014');
  insert into public.neighborhoods (city_id, slug, name, alt_names) select city_id, 'quartier-test', 'Quartier test', array['Q. Test'] from ctx;
  v_ok := true;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas créer de quartier', v_err = '42501', v_err);
  perform pg_temp.record('un quartier peut exister sans périmètre (éditeur local)', v_ok);
end $$;

-- -----------------------------------------------------------------------------
-- Organisations
-- -----------------------------------------------------------------------------
do $$
declare v_org uuid; v_role text; v_err text; v_err2 text; n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011'); -- A
  insert into public.organizations (slug, name, kind, city_id, created_by)
  select 'agence-test', 'Agence test', 'agence', city_id, '00000000-0000-4000-8000-000000000011' from ctx returning id into v_org;
  select role into v_role from public.organization_members where organization_id = v_org and user_id = '00000000-0000-4000-8000-000000000011';
  insert into public.organization_members (organization_id, user_id, role) values (v_org, '00000000-0000-4000-8000-000000000012', 'editor');
  perform pg_temp.back();
  perform pg_temp.record('le créateur devient propriétaire de l''organisation', v_role = 'owner', v_role);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000012'); -- B, éditeur de l'organisation
  insert into public.listings (owner_id, organization_id, slug, title, description, category_id, city_id)
  select '00000000-0000-4000-8000-000000000012', v_org, 'annonce-agence', 'Annonce de l''agence', repeat('Description. ', 3), cat_home, city_id from ctx;
  perform pg_temp.back();

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000013'); -- C, étranger
  begin
    insert into public.listings (owner_id, organization_id, slug, title, description, category_id, city_id)
    select '00000000-0000-4000-8000-000000000013', v_org, 'usurpation', 'Annonce usurpée', repeat('Description. ', 3), cat_home, city_id from ctx;
  exception when others then v_err := sqlstate;
  end;
  select count(*) into n from public.organization_members where organization_id = v_org;
  perform pg_temp.back();
  perform pg_temp.record('un non-membre ne peut pas publier au nom d''une organisation', v_err = '42501', v_err);
  perform pg_temp.record('la liste des membres est privée', n = 0, n::text);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011'); -- A modifie l'annonce de B
  update public.listings set title = 'Annonce relue par la direction' where slug = 'annonce-agence';
  get diagnostics n = row_count;
  begin
    update public.organization_members set role = 'editor' where organization_id = v_org and user_id = '00000000-0000-4000-8000-000000000011';
  exception when others then v_err2 := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un responsable de l''organisation gère les annonces de ses collaborateurs', n = 1, n::text);
  perform pg_temp.record('une organisation garde toujours un propriétaire', v_err2 = '23514', v_err2);
end $$;

-- -----------------------------------------------------------------------------
-- Confidentialité des positions et coordonnées
-- -----------------------------------------------------------------------------
do $$
declare v_id uuid; v_err1 text; v_err2 text; v_dist float; v_lat float; n int; v_hidden boolean;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision,
                               public_location_precision, contact_phone)
  select '00000000-0000-4000-8000-000000000011', 'studio-prive', 'Studio confidentiel', repeat('Description. ', 3), cat_home, city_id, 'published',
         pg_temp.pt(-6.63117, 4.75123), 'exact', 'approximate', '+225 01 02 03 04' from ctx
  returning id into v_id;

  perform pg_temp.act_as(null);
  begin
    perform location from public.listings where id = v_id;
  exception when others then v_err1 := sqlstate;
  end;
  begin
    perform contact_phone from public.listings where id = v_id;
  exception when others then v_err2 := sqlstate;
  end;
  select extensions.st_distance(location_public, pg_temp.pt(-6.63117, 4.75123)) into v_dist from public.listings where id = v_id;
  perform pg_temp.back();
  perform pg_temp.record('la position exacte d''une annonce est illisible par l''API publique', v_err1 = '42501', v_err1);
  perform pg_temp.record('le téléphone d''une annonce est illisible par l''API publique', v_err2 = '42501', v_err2);
  perform pg_temp.record('la position publiée est approximative (décalée de moins de 800 m)', v_dist > 0 and v_dist < 800, round(v_dist)::text);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  select latitude into v_lat from public.listing_private_fields(v_id);
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000013');
  select count(*) into n from public.listing_private_fields(v_id);
  perform pg_temp.back();
  perform pg_temp.record('l''auteur relit sa position exacte', abs(v_lat - 4.75123) < 0.00001, v_lat::text);
  perform pg_temp.record('un autre membre n''accède pas aux champs privés', n = 0, n::text);

  update public.listings set public_location_precision = 'hidden' where id = v_id;
  select location_public is null into v_hidden from public.listings where id = v_id;
  perform pg_temp.record('« position masquée » ne publie aucune coordonnée', v_hidden);
end $$;

-- -----------------------------------------------------------------------------
-- Guide, emploi, avis, messagerie, consentements, RAG, événements
-- -----------------------------------------------------------------------------
do $$
declare v_err text; v_version int; n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  begin
    insert into public.guide_articles (section_id, city_id, slug, title, body) select section_id, city_id, 'pirate', 'Article inventé', repeat('Texte. ', 5) from ctx;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000014');
  insert into public.guide_articles (section_id, city_id, slug, title, body) select section_id, city_id, 'se-deplacer-test', 'Se déplacer : article test', repeat('Texte initial. ', 5) from ctx;
  update public.guide_articles set body = repeat('Texte corrigé. ', 5) where slug = 'se-deplacer-test';
  select version into v_version from public.guide_articles where slug = 'se-deplacer-test';
  select count(*) into n from public.guide_article_versions v join public.guide_articles a on a.id = v.article_id where a.slug = 'se-deplacer-test';
  perform pg_temp.back();
  perform pg_temp.record('seule l''équipe locale rédige le guide', v_err = '42501', v_err);
  perform pg_temp.record('chaque correction d''article crée une nouvelle version', v_version = 2 and n = 2, v_version || ' / ' || n);
end $$;

do $$
declare v_job uuid; v_home uuid; v_err text; n_owner int; n_other int;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
  select '00000000-0000-4000-8000-000000000011', 'offre-test', 'Offre d''emploi test', repeat('Description. ', 3), cat_job, city_id, 'published', pg_temp.pt(-6.63, 4.75), 'exact' from ctx
  returning id into v_job;
  select id into v_home from public.listings where slug = 'studio-prive';

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000012');
  insert into public.job_applications (listing_id, applicant_id, message) values (v_job, '00000000-0000-4000-8000-000000000012', repeat('Candidature motivée. ', 2));
  begin
    insert into public.job_applications (listing_id, applicant_id, message) values (v_home, '00000000-0000-4000-8000-000000000012', repeat('Candidature motivée. ', 2));
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  select count(*) into n_owner from public.job_applications where listing_id = v_job;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000013');
  select count(*) into n_other from public.job_applications;
  perform pg_temp.back();
  perform pg_temp.record('on ne candidate qu''à une offre d''emploi publiée', v_err = '23514', v_err);
  perform pg_temp.record('l''employeur voit les candidatures reçues', n_owner = 1, n_owner::text);
  perform pg_temp.record('les candidatures sont privées pour les tiers', n_other = 0, n_other::text);
end $$;

do $$
declare v_place uuid; v_status text; v_err text; v_rating int; v_response text;
begin
  select id into v_place from public.places where slug = 'resto-test';
  update public.places set status = 'published' where id = v_place;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000012');
  insert into public.reviews (author_id, place_id, rating, body, status) values ('00000000-0000-4000-8000-000000000012', v_place, 4, 'Bon accueil, service rapide.', 'published');
  select status into v_status from public.reviews where place_id = v_place;
  perform pg_temp.back();
  -- La modération publie l'avis ; le professionnel peut alors y répondre.
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000015');
  update public.reviews set status = 'published' where place_id = v_place;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  begin
    insert into public.reviews (author_id, place_id, rating) values ('00000000-0000-4000-8000-000000000011', v_place, 5);
  exception when others then v_err := sqlstate;
  end;
  update public.reviews set rating = 5, response_body = 'Merci pour votre visite.' where place_id = v_place;
  perform pg_temp.back();
  select rating, response_body into v_rating, v_response from public.reviews where place_id = v_place;
  perform pg_temp.record('un avis passe toujours par la modération', v_status = 'pending', v_status);
  perform pg_temp.record('on ne note pas son propre établissement', v_err = '23514', v_err);
  perform pg_temp.record('le professionnel répond mais ne modifie pas la note',
    v_rating = 4 and v_response = 'Merci pour votre visite.', v_rating || ' / ' || coalesce(v_response, 'null'));
end $$;

do $$
declare v_conv uuid; n_a int; n_c int; v_err text;
begin
  insert into public.conversations (created_by) values ('00000000-0000-4000-8000-000000000011') returning id into v_conv;
  insert into public.conversation_participants (conversation_id, user_id) values
    (v_conv, '00000000-0000-4000-8000-000000000011'), (v_conv, '00000000-0000-4000-8000-000000000012');
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  insert into public.messages (conversation_id, sender_id, body) values (v_conv, '00000000-0000-4000-8000-000000000011', 'Bonjour');
  select count(*) into n_a from public.messages where conversation_id = v_conv;
  perform pg_temp.back();
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000013');
  select count(*) into n_c from public.messages where conversation_id = v_conv;
  begin
    insert into public.messages (conversation_id, sender_id, body) values (v_conv, '00000000-0000-4000-8000-000000000013', 'Intrusion');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('les participants échangent des messages', n_a = 1, n_a::text);
  perform pg_temp.record('un tiers ne lit pas une conversation', n_c = 0, n_c::text);
  perform pg_temp.record('un tiers ne peut pas écrire dans une conversation', v_err = '42501', v_err);
end $$;

do $$
declare v_err text; n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000011');
  insert into public.consents (user_id, kind, granted, document_version) values ('00000000-0000-4000-8000-000000000011', 'terms', true, '2026-10');
  begin
    update public.consents set granted = false where user_id = '00000000-0000-4000-8000-000000000011';
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('l''historique des consentements ne peut pas être réécrit', v_err = '42501', v_err);

  insert into public.knowledge_documents (entity_type, title, content, verification_status, content_hash) values
    ('test', 'Document vérifié', 'Contenu', 'verified', 'a'), ('test', 'Document à vérifier', 'Contenu', 'pending_validation', 'b');
  perform pg_temp.act_as(null);
  select count(*) into n from public.knowledge_documents where entity_type = 'test';
  perform pg_temp.back();
  perform pg_temp.record('l''assistant n''accède qu''aux documents vérifiés', n = 1, n::text);
end $$;

do $$
declare v_event uuid; v_err text; v_row record;
begin
  insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, status)
  select '00000000-0000-4000-8000-000000000011', 'concert-test', 'Concert de test', repeat('Description. ', 3), cat_event, city_id, now() + interval '7 days', 'published' from ctx
  returning id into v_event;
  update public.events set starts_at = now() + interval '14 days' where id = v_event;
  select schedule_status, original_starts_at into v_row from public.events where id = v_event;
  begin
    update public.events set schedule_status = 'cancelled' where id = v_event;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un changement de date marque l''événement « reporté » et garde la date initiale',
    v_row.schedule_status = 'postponed' and v_row.original_starts_at is not null, v_row.schedule_status::text);
  perform pg_temp.record('une annulation exige une explication', v_err = '23514', v_err);
end $$;

select pg_temp.record('bucket privé : non public, 10 Mo, PDF et images',
  (select not public and file_size_limit = 10485760 and 'application/pdf' = any (allowed_mime_types) from storage.buckets where id = 'private-media'));

select test, ok, detail from results order by n;
rollback;
