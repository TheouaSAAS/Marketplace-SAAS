-- =============================================================================
-- Niveau 3 : comptes. Exécuté sur la vraie base dans une transaction annulée.
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

-- Inscriptions simulées : métadonnées posées par l'action serveur.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro@test.invalid',
   '{"display_name":"Futur pro","account_intent":"professionnel","consents":{"terms":"2026-10","privacy":"2026-10","marketing_email":true}}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nonconfirme@test.invalid',
   '{"display_name":"Non confirmé","consents":{"terms":"2026-10","privacy":"2026-10"}}', null, now(), now()),
  ('00000000-0000-4000-8000-000000000033', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre3@test.invalid',
   '{}', now(), now(), now());

select pg_temp.record('l''inscription enregistre le type de compte déclaré',
  (select account_intent = 'professionnel' from public.user_preferences where user_id = '00000000-0000-4000-8000-000000000031'));
select pg_temp.record('l''inscription enregistre les consentements datés et versionnés',
  (select count(*) = 3 and bool_and(document_version = '2026-10') from public.consents where user_id = '00000000-0000-4000-8000-000000000031'),
  (select count(*)::text from public.consents where user_id = '00000000-0000-4000-8000-000000000031'));
select pg_temp.record('sans choix marketing, aucun consentement marketing n''est présumé',
  not exists (select 1 from public.consents where user_id = '00000000-0000-4000-8000-000000000032' and kind = 'marketing_email'));
select pg_temp.record('« professionnel » déclaré n''accorde aucun rôle automatiquement',
  (select role = 'user' from public.profiles where id = '00000000-0000-4000-8000-000000000031'));

-- Particulier → professionnel
do $$
declare v_err text; v_role text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000032');
  begin
    perform public.become_professional();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('passer professionnel exige une adresse confirmée', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000031');
  perform public.become_professional();
  perform pg_temp.back();
  select role into v_role from public.profiles where id = '00000000-0000-4000-8000-000000000031';
  perform pg_temp.record('un compte confirmé devient professionnel', v_role = 'professional', v_role);
  perform pg_temp.record('la transition est journalisée',
    exists (select 1 from public.admin_audit_log where action = 'account.become_professional' and entity_id = '00000000-0000-4000-8000-000000000031'));
end $$;

-- Professionnel → particulier bloqué tant qu'il possède une organisation
do $$
declare v_err text; v_role text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000031');
  insert into public.organizations (slug, name, city_id, created_by)
  select 'orga-test-3', 'Organisation test', id, '00000000-0000-4000-8000-000000000031' from public.cities where slug = 'san-pedro';
  begin
    perform public.become_individual();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un propriétaire d''organisation ne peut pas redevenir particulier', v_err = '23514', v_err);
end $$;

-- Export : uniquement ses propres données
do $$
declare v_export jsonb; v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000031');
  v_export := public.export_my_data();
  perform pg_temp.back();
  perform pg_temp.record('l''export contient le compte et les consentements de l''utilisateur',
    v_export -> 'compte' ->> 'email' = 'pro@test.invalid' and jsonb_array_length(v_export -> 'consentements') = 3,
    v_export -> 'compte' ->> 'email');
  perform pg_temp.record('l''export ne contient pas la position exacte des annonces', position('"location"' in v_export::text) = 0);

  perform pg_temp.act_as(null);
  begin
    perform public.export_my_data();
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un visiteur ne peut rien exporter', v_err = '42501', v_err);
end $$;

-- Limitation de débit réservée au serveur
do $$
declare v_err text; v_first boolean; v_third boolean;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000033');
  begin
    perform public.consume_rate_limit('cle', 100, 60);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un client ne peut pas manipuler les compteurs anti-abus', v_err = '42501', v_err);

  v_first := public.consume_rate_limit('test-cle', 2, 60);
  perform public.consume_rate_limit('test-cle', 2, 60);
  v_third := public.consume_rate_limit('test-cle', 2, 60);
  perform pg_temp.record('le compteur bloque au-delà de la limite', v_first and not v_third, v_first || ' / ' || v_third);
end $$;

-- Suppression de compte : pseudonymisation des références conservées
do $$
declare v_place uuid; v_payment uuid; v_creator uuid; v_user uuid;
begin
  insert into public.places (kind, created_by, slug, name, category_id, city_id)
  select 'etablissement', '00000000-0000-4000-8000-000000000033', 'lieu-suppression', 'Lieu test', k.id, c.id
  from public.categories k, public.cities c where k.slug = 'restaurants-gastronomie' and c.slug = 'san-pedro'
  returning id into v_place;
  insert into public.plans (code, name) values ('test_plan', 'Plan test');
  insert into public.subscriptions (user_id, plan_id) select '00000000-0000-4000-8000-000000000033', id from public.plans where code = 'test_plan';
  insert into public.payments (user_id, subscription_id, amount_xof, provider)
  select '00000000-0000-4000-8000-000000000033', id, 1000, 'wave' from public.subscriptions where user_id = '00000000-0000-4000-8000-000000000033'
  returning id into v_payment;

  delete from auth.users where id = '00000000-0000-4000-8000-000000000033';

  select created_by into v_creator from public.places where id = v_place;
  select user_id into v_user from public.payments where id = v_payment;
  perform pg_temp.record('la suppression du compte supprime le profil',
    not exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000033'));
  perform pg_temp.record('une fiche de lieu est conservée, son créateur effacé', v_creator is null and exists (select 1 from public.places where id = v_place));
  perform pg_temp.record('un paiement est conservé pour la comptabilité, détaché du compte', v_user is null and exists (select 1 from public.payments where id = v_payment));
end $$;

select pg_temp.record('tâches planifiées actives (expiration, purge anti-abus)',
  (select count(*) = 2 from cron.job where jobname in ('expirer-annonces', 'purger-anti-abus') and active));

select test, ok, detail from results order by n;
rollback;
