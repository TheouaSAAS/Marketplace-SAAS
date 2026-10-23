-- =============================================================================
-- Niveau 22 : administration et back-office (droits par rôle, sanctions
-- journalisées, signalements et suspension, qualité, doublons, campagnes).
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
  ('00000000-0000-4000-8000-000000002201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin22@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderateur22@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur22@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'annonceur22@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002205', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'temoin22@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002206', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'temoinbis22@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002201';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000002202';
update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000002203';
update public.profiles set display_name = 'Zqb Annonceur' where id = '00000000-0000-4000-8000-000000002204';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_admin uuid := '00000000-0000-4000-8000-000000002201';
  v_moderator uuid := '00000000-0000-4000-8000-000000002202';
  v_editor uuid := '00000000-0000-4000-8000-000000002203';
  v_member uuid := '00000000-0000-4000-8000-000000002204';
  v_witness uuid := '00000000-0000-4000-8000-000000002205';
  v_witness2 uuid := '00000000-0000-4000-8000-000000002206';
  v_listing uuid; v_comment uuid; v_report uuid; v_report2 uuid; v_comment_report uuid; v_source uuid;
  v_keep uuid; v_dup uuid; v_old uuid; v_campaign uuid; v_org uuid;
  v_err text; n int; v_json jsonb; v_text text;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
  values (v_member, 'zqb-annonce', 'Zqb Téléphone à vendre', repeat('Description de test. ', 3), (select id from public.categories where slug = 'immobilier-location'),
          v_city, 'published', extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact')
  returning id into v_listing;
  insert into public.listing_comments (listing_id, author_id, body) values (v_listing, v_witness, 'Zqb commentaire insultant') returning id into v_comment;

  -- Comptes : réservé aux administrateurs
  perform pg_temp.act_as(v_moderator);
  v_err := null;
  begin
    perform * from public.admin_accounts('annonceur22');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un modérateur ne consulte pas les comptes', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.admin_set_account(v_member, null, true, 'Arnaques répétées');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un modérateur ne sanctionne pas un compte', v_err = '42501', v_err);
  v_err := null;
  begin
    perform * from public.admin_audit_entries();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un modérateur ne lit pas le journal des actions sensibles', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_admin);
  select count(*), max(email) into n, v_text from public.admin_accounts('annonceur22');
  perform pg_temp.record('un administrateur retrouve un compte par son adresse', n = 1 and v_text = 'annonceur22@test.invalid', n::text);
  v_err := null;
  begin
    perform public.admin_set_account(v_member, null, true, '  ');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une sanction exige une raison', v_err = '23514', v_err);
  perform public.admin_set_account(v_member, null, true, 'Arnaques répétées signalées');
  perform pg_temp.record('l''administrateur suspend le compte', (select is_suspended from public.profiles where id = v_member));
  select details into v_json from public.admin_audit_entries('compte.suspension') where entity_id = v_member limit 1;
  perform pg_temp.record('la suspension est journalisée avec auteur, raison, avant et après',
    v_json ->> 'raison' = 'Arnaques répétées signalées' and v_json ->> 'avant' = 'false' and v_json ->> 'apres' = 'true'
    and exists (select 1 from public.admin_audit_entries('compte.suspension') where entity_id = v_member and actor_id = v_admin), v_json::text);
  v_err := null;
  begin
    perform public.admin_set_account(v_member, 'admin', null, 'Promotion sans droit');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un administrateur ne crée pas d''administrateur', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.admin_set_account(v_admin, 'user', null, 'Auto-rétrogradation');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('on ne modifie pas son propre compte', v_err = '42501', v_err);
  perform public.admin_set_account(v_member, null, false, 'Levée après vérification');
  update public.profiles set role = 'professional' where id = v_member;
  select count(*) into n from public.admin_audit_entries('compte.') where entity_id = v_member;
  perform pg_temp.record('tout changement de rôle est journalisé, même hors du back-office', n = 3, n::text);
  perform pg_temp.back();

  -- Signalements
  perform pg_temp.act_as(v_witness);
  insert into public.reports (reporter_id, listing_id, reason, details) values (v_witness, v_listing, 'arnaque', 'Demande un acompte') returning id into v_report;
  insert into public.reports (reporter_id, comment_id, reason) values (v_witness, v_comment, 'contenu_inapproprie') returning id into v_comment_report;
  v_err := null;
  begin
    perform * from public.admin_reports(true);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre ne voit pas la file des signalements', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_witness2);
  insert into public.reports (reporter_id, listing_id, reason) values (v_witness2, v_listing, 'arnaque') returning id into v_report2;
  perform pg_temp.back();

  perform pg_temp.act_as(v_editor);
  v_err := null;
  begin
    perform public.handle_report(v_report, 'resolu', null);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un éditeur local ne traite pas les signalements', v_err = '42501', v_err);
  select count(*) into n from public.quality_items('signales');
  perform pg_temp.record('ni ne voit les contenus signalés dans la qualité', n = 0, n::text);
  perform pg_temp.back();

  perform pg_temp.act_as(v_moderator);
  select target_reports, target_title into n, v_text from public.admin_reports(true) where id = v_report;
  perform pg_temp.record('la file présente le contenu visé et le nombre de signalements', n = 2 and v_text = 'Zqb Téléphone à vendre', coalesce(v_text, '-'));
  select count(*) into n from public.admin_reports(true) where id = v_report and target_owner = v_member;
  perform pg_temp.record('elle désigne le compte responsable (pour une sanction)', n = 1);
  v_err := null;
  begin
    perform public.handle_report(v_report, 'suspendre', null);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une suspension exige une raison', v_err = '23514', v_err);
  perform public.handle_report(v_report, 'suspendre', 'Demande d''acompte avant visite');
  perform pg_temp.back();
  select status::text, rejection_reason into v_text, v_err from public.listings where id = v_listing;
  perform pg_temp.record('le contenu est aussitôt retiré, motif à l''appui', v_text = 'rejected' and v_err like 'Suspendue après signalement : Demande%', v_text);
  select count(*) into n from public.reports where id in (v_report, v_report2) and status = 'resolved' and handled_by = v_moderator;
  perform pg_temp.record('tous les signalements ouverts sur ce contenu sont clos', n = 2, n::text);
  select count(*) into n from public.notifications
  where user_id = v_member and type = 'moderation' and title = 'Annonce suspendue : Zqb Téléphone à vendre' and body like 'Motif : Demande d''acompte%';
  perform pg_temp.record('l''annonceur est notifié du motif (notification non désactivable)', n = 1, n::text);
  select count(*) into n from public.admin_audit_log where action = 'signalement.suspendre' and entity_id = v_report and actor_id = v_moderator;
  perform pg_temp.record('la décision est journalisée', n = 1, n::text);
  select count(*) into n from public.content_revisions where entity_type = 'listings' and entity_id = v_listing and reason = 'Demande d''acompte avant visite';
  perform pg_temp.record('l''historique de l''annonce garde l''avant, l''après et la raison', n = 1, n::text);

  perform pg_temp.act_as(v_moderator);
  perform public.handle_report(v_comment_report, 'suspendre', 'Propos insultants');
  perform pg_temp.back();
  perform pg_temp.record('un commentaire signalé est masqué', (select status::text from public.listing_comments where id = v_comment) = 'hidden');

  -- Tableau de bord et qualité
  insert into public.sources (kind, title, collected_at) values ('terrain', 'Zqb relevé', current_date - 400) returning id into v_source;
  insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, verified_at, verified_by, source_id)
  values ('etablissement', v_editor, 'zqb-ancien', 'Zqb Ancien relevé', (select id from public.categories where slug = 'alimentation'), v_city,
          'published', 'verified', now() - interval '13 months', v_editor, v_source) returning id into v_old;
  perform pg_temp.act_as(v_member);
  v_err := null;
  begin
    perform public.admin_overview();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre n''accède pas au tableau de bord', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_editor);
  v_json := public.admin_overview();
  perform pg_temp.record('le tableau de bord donne les volumes des files', (v_json ->> 'to_revalidate')::int >= 1 and v_json ? 'reports', v_json::text);
  select count(*) into n from public.quality_items('a_revalider') where entity_id = v_old and detail = 'Zqb relevé';
  perform pg_temp.record('une donnée vérifiée il y a plus de 12 mois est à revalider', n = 1, n::text);
  perform pg_temp.back();

  -- Doublons
  insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status, phone, location, location_precision)
  values
    ('etablissement', v_editor, 'zqb-boulangerie-port', 'Zqb Boulangerie du Port', (select id from public.categories where slug = 'alimentation'), v_city,
     'published', 'pending_validation', '07 00 00 22 01', extensions.st_setsrid(extensions.st_makepoint(-6.6301, 4.7401), 4326)::extensions.geography, 'exact'),
    ('etablissement', v_member, 'zqb-boulangerie-port-2', 'Zqb Boulangerie du port', (select id from public.categories where slug = 'alimentation'), v_city,
     'published', 'pending_validation', '0700002201', extensions.st_setsrid(extensions.st_makepoint(-6.6302, 4.7402), 4326)::extensions.geography, 'exact');
  v_keep := (select id from public.places where slug = 'zqb-boulangerie-port');
  v_dup := (select id from public.places where slug = 'zqb-boulangerie-port-2');
  insert into public.favorites (user_id, place_id) values (v_witness, v_dup), (v_witness2, v_dup), (v_witness2, v_keep);
  insert into public.place_likes (place_id, user_id) values (v_dup, v_witness);

  perform pg_temp.act_as(v_moderator);
  v_err := null;
  begin
    perform * from public.place_duplicates();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('la fusion de doublons relève des éditeurs locaux', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_editor);
  select count(*) into n from public.place_duplicates() where (a_id, b_id) in ((v_keep, v_dup), (v_dup, v_keep)) and same_phone;
  perform pg_temp.record('deux fiches proches au même nom et au même numéro sont détectées', n = 1, n::text);
  v_json := public.merge_places(v_keep, v_dup, 'Même boulangerie, deux fiches');
  perform pg_temp.record('la fusion transfère favoris et « j''aime » sans doublon',
    (v_json ->> 'favoris')::int = 1 and (v_json ->> 'jaime')::int = 1, v_json::text);
  perform pg_temp.back();
  select count(*) into n from public.favorites where place_id = v_keep;
  perform pg_temp.record('chaque membre garde un seul favori sur la fiche conservée', n = 2, n::text);
  perform pg_temp.record('le doublon est archivé, jamais supprimé, et pointe vers la fiche conservée',
    (select status::text = 'archived' and merged_into = v_keep from public.places where id = v_dup));
  select count(*) into n from public.admin_audit_log where action = 'lieu.fusion' and entity_id = v_keep and actor_id = v_editor;
  perform pg_temp.record('la fusion est journalisée', n = 1, n::text);
  perform pg_temp.act_as(v_editor);
  select count(*) into n from public.admin_revisions('places', v_dup) where reason like 'Fusion de doublons%' and changed_by = v_editor;
  perform pg_temp.record('l''historique du doublon garde la raison et l''auteur', n = 1, n::text);
  v_err := null;
  begin
    perform public.merge_places(v_keep, v_dup, 'Deuxième tentative');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une fiche ne se fusionne qu''une fois', v_err = '23514', v_err);
  perform pg_temp.back();

  -- Mises en avant
  insert into public.sponsored_campaigns (owner_id, place_id, placement, city_id, starts_at, ends_at, budget_xof, status)
  values (v_member, v_keep, 'home', v_city, now(), now() + interval '7 days', 0, 'draft') returning id into v_campaign;
  perform pg_temp.act_as(v_admin);
  v_err := null;
  begin
    perform public.admin_set_campaign_status(v_campaign, 'active', 'Activation offerte');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('aucune campagne ne s''active sans paiement', v_err = '22023', v_err);
  perform public.admin_set_campaign_status(v_campaign, 'rejected', 'Contenu non conforme');
  perform pg_temp.record('l''administrateur refuse une campagne, décision journalisée',
    (select status::text from public.sponsored_campaigns where id = v_campaign) = 'rejected'
    and exists (select 1 from public.admin_audit_log where action = 'campagne.statut' and entity_id = v_campaign));
  perform pg_temp.back();

  -- Organisations
  insert into public.organizations (name, slug, kind, city_id, created_by) values ('Zqb Organisation', 'zqb-organisation', 'commerce', v_city, v_member) returning id into v_org;
  perform pg_temp.act_as(v_moderator);
  v_err := null;
  begin
    perform public.admin_set_organization(v_org, true, 'Activité frauduleuse');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un modérateur ne suspend pas une organisation', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_admin);
  perform public.admin_set_organization(v_org, true, 'Activité frauduleuse');
  perform pg_temp.back();
  perform pg_temp.record('la suspension d''une organisation est journalisée',
    exists (select 1 from public.admin_audit_log where action = 'organisation.suspension' and entity_id = v_org and details ->> 'raison' = 'Activité frauduleuse'));
end $$;

select test, ok, detail from results order by n;
rollback;
