-- =============================================================================
-- Connexion, inscription et administration : aucun rôle par l'inscription,
-- droits du back-office seulement avec le second facteur, journal des accès.
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated;
grant usage on sequence results_n_seq to anon, authenticated;

-- Session d'un membre, avec ou sans second facteur (« aal »).
create function pg_temp.act_as(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.record(p_test text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;

-- Inscriptions publiques (métadonnées fournies par le navigateur, donc non fiables).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000002901', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pirate29@test.invalid',
   '{"display_name": "Pirate", "role": "superadmin", "account_intent": "particulier"}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002902', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro29@test.invalid',
   jsonb_build_object('display_name', 'Awa Pro', 'account_intent', 'professionnel',
                      'business', jsonb_build_object('name', 'Zq Salon Awa', 'category_id', (select id from public.categories where is_active and 'business' = any (content_types) limit 1))),
   now(), now(), now()),
  ('00000000-0000-4000-8000-000000002903', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro29b@test.invalid',
   jsonb_build_object('display_name', 'Kofi', 'account_intent', 'professionnel',
                      'business', jsonb_build_object('name', 'Zq Garage', 'category_id', (select id from public.categories where not ('business' = any (content_types)) limit 1))),
   now(), now(), now()),
  ('00000000-0000-4000-8000-000000002904', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin29@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002905', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'modo29@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002904';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000002905';

do $$
declare
  v_pirate uuid := '00000000-0000-4000-8000-000000002901';
  v_pro uuid := '00000000-0000-4000-8000-000000002902';
  v_pro_b uuid := '00000000-0000-4000-8000-000000002903';
  v_admin uuid := '00000000-0000-4000-8000-000000002904';
  v_modo uuid := '00000000-0000-4000-8000-000000002905';
  v_err text; v_bool boolean; v_role text; n int;
begin
  -- Inscription
  perform pg_temp.record('une inscription ne donne jamais de rôle (métadonnée « superadmin » ignorée)',
    (select role = 'user' from public.profiles where id = v_pirate), (select role::text from public.profiles where id = v_pirate));
  perform pg_temp.record('un profil professionnel déclaré reste un membre jusqu''à sa propre démarche',
    (select role = 'user' from public.profiles where id = v_pro));
  perform pg_temp.record('le nom et le secteur de l''activité sont conservés pour la future page',
    (select pending_business_name = 'Zq Salon Awa' and pending_business_category is not null and account_intent = 'professionnel' from public.user_preferences where user_id = v_pro));
  perform pg_temp.record('un secteur qui n''est pas une activité professionnelle est ignoré',
    (select pending_business_name = 'Zq Garage' and pending_business_category is null from public.user_preferences where user_id = v_pro_b));
  perform pg_temp.record('aucune page professionnelle n''est créée à l''inscription',
    not exists (select 1 from public.business_profiles where owner_id in (v_pro, v_pro_b)));

  perform pg_temp.act_as(v_pirate, 'aal2');
  v_err := null;
  begin
    update public.profiles set role = 'admin' where id = v_pirate;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne peut pas s''attribuer un rôle', (select role = 'user' from public.profiles where id = v_pirate), coalesce(v_err, 'aucune erreur'));

  -- Second facteur du back-office
  perform pg_temp.act_as(v_admin, 'aal1');
  v_bool := public.is_admin();
  v_role := public.current_user_role()::text;
  select count(*) into n from public.admin_access_log;
  perform pg_temp.back();
  perform pg_temp.record('sans second facteur, un administrateur agit comme un membre', not v_bool and v_role = 'user', v_role);

  perform pg_temp.act_as(v_modo, 'aal1');
  v_bool := public.is_staff();
  perform pg_temp.back();
  perform pg_temp.record('de même pour la modération', not v_bool);

  perform pg_temp.act_as(v_admin, 'aal2');
  v_bool := public.is_admin();
  perform pg_temp.back();
  perform pg_temp.record('avec le second facteur, les droits d''administration s''appliquent', v_bool);

  -- Le réglage est lu par la base elle-même (désactivation possible par l'équipe, ici annulée).
  update public.platform_settings set value = '{"enabled": false}' where key = 'security.backoffice_mfa';
  perform pg_temp.act_as(v_admin, 'aal1');
  v_bool := public.is_admin();
  perform pg_temp.back();
  update public.platform_settings set value = '{"enabled": true}' where key = 'security.backoffice_mfa';
  perform pg_temp.record('le second facteur se règle par la plateforme', v_bool);

  -- Journal des accès
  insert into public.admin_access_log (event, user_id) values ('connexion', v_admin);
  insert into public.admin_access_log (event, email_fingerprint) values ('echec', repeat('a', 64));
  perform pg_temp.act_as(v_admin, 'aal1');
  select count(*) into n from public.admin_access_log where user_id = v_admin or email_fingerprint = repeat('a', 64);
  perform pg_temp.back();
  perform pg_temp.record('le journal des accès est fermé sans second facteur', n = 0, n::text);
  perform pg_temp.act_as(v_admin, 'aal2');
  select count(*) into n from public.admin_access_log where user_id = v_admin or email_fingerprint = repeat('a', 64);
  perform pg_temp.back();
  perform pg_temp.record('un administrateur avec second facteur le consulte', n = 2, n::text);
  perform pg_temp.act_as(v_modo, 'aal2');
  select count(*) into n from public.admin_access_log where user_id = v_admin;
  v_err := null;
  begin
    insert into public.admin_access_log (event, user_id) values ('connexion', v_modo);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('la modération ne le lit pas, personne ne l''écrit depuis le navigateur', n = 0 and v_err = '42501', coalesce(v_err, 'insertion acceptée'));

  v_err := null;
  begin
    insert into public.admin_access_log (event, email_fingerprint) values ('echec', 'motdepasse123');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('seules des empreintes sont acceptées, jamais une valeur en clair', v_err = '23514', v_err);
end $$;

select test, ok, detail from results order by n;
rollback;
