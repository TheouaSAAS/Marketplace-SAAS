-- =============================================================================
-- Niveau 6 : parcours « Nouveau à San Pedro ? » — confidentialité des parcours enregistrés.
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

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'arrivant@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000062', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'curieux@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000063', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'moderation6@test.invalid', '{}', now(), now());
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000000063';

do $$
declare n_own int; n_other int; n_staff int; n_anon int; v_err text;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000061');
  insert into public.newcomer_plans (user_id, answers) values ('00000000-0000-4000-8000-000000000061', '{"purpose":"s_installer","duration":"longue_duree","housing":"location","version":1}');
  select count(*) into n_own from public.newcomer_plans;
  perform pg_temp.back();

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000062');
  select count(*) into n_other from public.newcomer_plans;
  begin
    insert into public.newcomer_plans (user_id, answers) values ('00000000-0000-4000-8000-000000000061', '{}');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000063');
  select count(*) into n_staff from public.newcomer_plans;
  perform pg_temp.back();

  perform pg_temp.act_as(null);
  select count(*) into n_anon from public.newcomer_plans;
  perform pg_temp.back();

  perform pg_temp.record('un membre enregistre et relit son parcours', n_own = 1, n_own::text);
  perform pg_temp.record('un autre membre ne voit pas ce parcours', n_other = 0, n_other::text);
  perform pg_temp.record('on ne peut pas écrire le parcours d''un autre', v_err in ('42501', '23505'), v_err);
  perform pg_temp.record('même la modération ne lit pas les parcours personnels', n_staff = 0, n_staff::text);
  perform pg_temp.record('un visiteur ne lit aucun parcours', n_anon = 0, n_anon::text);
end $$;

do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000061');
  delete from public.newcomer_plans where user_id = '00000000-0000-4000-8000-000000000061';
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('le membre supprime son parcours lui-même', n = 1, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
