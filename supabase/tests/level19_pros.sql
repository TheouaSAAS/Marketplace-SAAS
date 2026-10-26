-- =============================================================================
-- Niveau 19 : pages professionnelles (modération, équipe et invitations,
-- revendication, vérification, badges, avis anti-manipulation).
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

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000001901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro19@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'collegue19@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client19@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001904', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nouveau19@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001905', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'equipe19@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'professional', display_name = 'Zqp Pro' where id = '00000000-0000-4000-8000-000000001901';
update public.profiles set display_name = 'Zqp Collègue' where id = '00000000-0000-4000-8000-000000001902';
update public.profiles set display_name = 'Zqp Client', created_at = now() - interval '30 days' where id = '00000000-0000-4000-8000-000000001903';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000001905';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_category uuid := (select id from public.categories where slug = 'plomberie');
  v_pro uuid := '00000000-0000-4000-8000-000000001901';
  v_colleague uuid := '00000000-0000-4000-8000-000000001902';
  v_client uuid := '00000000-0000-4000-8000-000000001903';
  v_newbie uuid := '00000000-0000-4000-8000-000000001904';
  v_team uuid := '00000000-0000-4000-8000-000000001905';
  v_business uuid; v_org uuid; v_token text; v_invitation uuid; v_err text; n int; v_text text; v_bool boolean;
  v_unclaimed uuid; v_claim uuid; v_request uuid; v_review uuid;
begin
  -- Création, soumission, publication
  perform pg_temp.act_as(v_pro);
  insert into public.business_profiles (owner_id, slug, name, description, category_id, city_id, status, services)
  values (v_pro, 'zqp-plomberie', 'Zqp Plomberie', 'Plomberie générale et dépannage à San Pedro.', v_category, v_city, 'draft', array['Dépannage'])
  returning id into v_business;
  update public.business_profiles set status = 'pending' where id = v_business;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*) into n from public.business_profiles where id = v_business;
  perform pg_temp.record('une page en attente est invisible du public', n = 0, n::text);
  perform pg_temp.back();
  perform pg_temp.act_as(v_team);
  update public.business_profiles set status = 'published' where id = v_business;
  perform pg_temp.back();
  perform pg_temp.record('la publication est notifiée au professionnel',
    exists (select 1 from public.notifications where user_id = v_pro and title = 'Page publiée : Zqp Plomberie'));

  -- Disponibilité sans nouvelle modération, contenu avec
  perform pg_temp.act_as(v_pro);
  update public.business_profiles set availability_note = 'Disponible cette semaine', accepts_quotes = false where id = v_business;
  select status::text into v_text from public.business_profiles where id = v_business;
  perform pg_temp.record('déclarer sa disponibilité ne renvoie pas en modération', v_text = 'published', v_text);
  perform pg_temp.back();

  -- Équipe et invitations
  perform pg_temp.act_as(v_pro);
  insert into public.organizations (name, slug, kind, city_id, created_by) values ('Zqp Plomberie', 'zqp-plomberie-equipe', 'artisan', v_city, v_pro) returning id into v_org;
  update public.business_profiles set organization_id = v_org where id = v_business;
  v_token := public.create_organization_invitation(v_org, 'editor');
  perform pg_temp.record('le propriétaire crée une invitation (lien secret)', length(v_token) = 64);
  perform pg_temp.record('seule l''empreinte du lien est gardée', not exists (select 1 from public.organization_invitations where token_hash = v_token));
  v_err := null;
  begin
    perform public.create_organization_invitation(v_org, 'owner');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('on n''invite pas un propriétaire', v_err = '23514', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_colleague);
  v_err := null;
  begin
    perform public.create_organization_invitation(v_org, 'viewer');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un non-membre ne crée pas d''invitation', v_err = '42501', v_err);
  select valid into v_bool from public.organization_invitation_preview(v_token);
  perform pg_temp.record('la personne invitée voit l''équipe avant d''accepter', v_bool);
  perform pg_temp.record('accepter l''invitation fait entrer dans l''équipe', public.accept_organization_invitation(v_token) = v_org);
  update public.business_profiles set description = 'Plomberie générale, dépannage et installation sanitaire.' where id = v_business;
  perform pg_temp.record('un membre « editor » modifie la page (retour en modération)', (select status from public.business_profiles where id = v_business) = 'pending');
  select count(*) into n from public.organization_team(v_org);
  perform pg_temp.record('l''équipe liste ses membres avec leur nom public', n = 2, n::text);
  v_err := null;
  begin
    perform public.create_organization_invitation(v_org, 'viewer');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un « editor » ne gère pas l''équipe', v_err = '42501', v_err);
  perform pg_temp.back();

  perform pg_temp.act_as(v_client);
  v_err := null;
  begin
    perform public.accept_organization_invitation(v_token);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un lien d''invitation ne sert qu''une fois', v_err = '23514', v_err);
  select count(*) into n from public.organization_team(v_org);
  perform pg_temp.record('un non-membre ne voit pas l''équipe', n = 0, n::text);
  perform pg_temp.back();

  perform pg_temp.act_as(v_pro);
  v_token := public.create_organization_invitation(v_org, 'viewer');
  select id into v_invitation from public.organization_invitations where organization_id = v_org and accepted_at is null;
  perform public.revoke_organization_invitation(v_invitation);
  perform pg_temp.back();
  perform pg_temp.act_as(v_client);
  v_err := null;
  begin
    perform public.accept_organization_invitation(v_token);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une invitation révoquée est refusée', v_err = '23514', v_err);
  perform pg_temp.back();

  -- Photo d'une page : privée, visible de l'équipe
  perform pg_temp.act_as(v_colleague);
  insert into public.images (owner_id, business_id, storage_path) values (v_colleague, v_business, v_colleague || '/pros/' || v_business || '/a.jpg');
  perform pg_temp.record('une photo de page déposée par l''équipe est privée d''office',
    (select bucket from public.images where business_id = v_business) = 'private-media');
  perform pg_temp.back();
  perform pg_temp.act_as(v_pro);
  perform pg_temp.record('un collègue habilité accède à la photo privée', public.can_manage_private_media(v_colleague || '/pros/' || v_business || '/a.jpg'));
  perform pg_temp.back();
  perform pg_temp.act_as(v_client);
  perform pg_temp.record('un tiers n''accède pas à la photo privée', not public.can_manage_private_media(v_colleague || '/pros/' || v_business || '/a.jpg'));
  perform pg_temp.back();

  -- Vérification demandée, décidée avec une source ; badges publics
  update public.business_profiles set status = 'published' where id = v_business;
  perform pg_temp.act_as(v_pro);
  insert into public.business_verification_requests (business_id, evidence) values (v_business, 'RCCM CI-SPY-2026-B-0000 à présenter') returning id into v_request;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select verification_pending into v_bool from public.business_public_badges(array[v_business]);
  perform pg_temp.record('badge public « en cours de validation » pendant la demande', v_bool);
  perform pg_temp.back();
  perform pg_temp.act_as(v_pro);
  v_err := null;
  begin
    perform public.decide_business_verification(v_request, true, 'Visite');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le professionnel ne se vérifie pas lui-même', v_err = '42501', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_team);
  v_err := null;
  begin
    perform public.decide_business_verification(v_request, true, '');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('« vérifié » exige une source', v_err = '23514', v_err);
  perform public.decide_business_verification(v_request, true, 'Registre du commerce consulté', 'RCCM conforme');
  perform pg_temp.back();
  perform pg_temp.record('la vérification est tracée avec sa source',
    (select verification_status = 'verified' and source_id is not null and verified_by = v_team from public.business_profiles where id = v_business));
  insert into public.sponsored_campaigns (business_id, city_id, placement, starts_at, ends_at, status, budget_xof)
  values (v_business, v_city, 'search', now() - interval '1 day', now() + interval '1 day', 'active', 0);
  perform pg_temp.act_as(null);
  select sponsored into v_bool from public.business_public_badges(array[v_business]);
  perform pg_temp.record('badge « sponsorisé » seulement avec une campagne active', v_bool);
  perform pg_temp.back();

  -- Revendication d'une page créée par l'équipe
  insert into public.business_profiles (owner_id, slug, name, category_id, city_id, status, is_claimed)
  values (v_team, 'zqp-orpheline', 'Zqp Orpheline', v_category, v_city, 'published', false) returning id into v_unclaimed;
  perform pg_temp.act_as(v_colleague);
  insert into public.place_claims (business_id, claimant_id, claimant_role, message, evidence, phone)
  values (v_unclaimed, v_colleague, 'proprietaire', 'C''est mon entreprise depuis 2019.', 'RCCM à présenter', '0700000000') returning id into v_claim;
  v_err := null;
  begin
    insert into public.place_claims (business_id, claimant_id, claimant_role, message, evidence, phone)
    values (v_business, v_colleague, 'proprietaire', 'C''est aussi la mienne.', 'RCCM', '0700000000');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une page déjà gérée ne se revendique pas', v_err = '23514', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_team);
  perform public.review_business_claim(v_claim, true, 'RCCM vérifié');
  perform pg_temp.back();
  perform pg_temp.record('une revendication validée transfère la page',
    (select owner_id = v_colleague and is_claimed from public.business_profiles where id = v_unclaimed));

  -- Avis : règles anti-manipulation
  perform pg_temp.act_as(v_newbie);
  v_err := null;
  begin
    insert into public.reviews (author_id, business_id, rating, body) values (v_newbie, v_business, 5, 'Excellent travail, très rapide.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un compte de moins de 7 jours ne publie pas d''avis', v_err = '23514', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_colleague);
  v_err := null;
  begin
    insert into public.reviews (author_id, business_id, rating) values (v_colleague, v_business, 5);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un membre de l''équipe n''évalue pas sa propre page', v_err = '23514', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_client);
  insert into public.reviews (author_id, business_id, rating, body, status) values (v_client, v_business, 4, 'Intervention propre et à l''heure.', 'published') returning id into v_review;
  perform pg_temp.record('un avis attend toujours la modération', (select status from public.reviews where id = v_review) = 'pending');
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*) into n from public.business_reviews(v_business);
  perform pg_temp.record('un avis en attente est invisible du public', n = 0, n::text);
  perform pg_temp.back();
  perform pg_temp.act_as(v_team);
  update public.reviews set status = 'published' where id = v_review;
  perform pg_temp.back();
  perform pg_temp.act_as(null);
  select count(*) into n from public.business_reviews(v_business);
  perform pg_temp.record('l''avis publié est lisible avec le nom public de l''auteur',
    n = 1 and (select author_name from public.business_reviews(v_business) limit 1) = 'Zqp Client', n::text);
  perform pg_temp.record('note moyenne publique', (select review_count = 1 and average = 4.0 from public.business_rating(v_business)));
  perform pg_temp.back();
  perform pg_temp.record('le professionnel est prévenu d''un nouvel avis',
    exists (select 1 from public.notifications where user_id = v_pro and title = 'Nouvel avis sur Zqp Plomberie'));
  perform pg_temp.act_as(v_colleague);
  update public.reviews set response_body = 'Merci pour votre confiance.', rating = 1 where id = v_review;
  perform pg_temp.back();
  perform pg_temp.record('l''équipe répond sans toucher à la note',
    (select response_body = 'Merci pour votre confiance.' and rating = 4 from public.reviews where id = v_review));
end $$;

select test, ok, detail from results order by n;
rollback;
