-- =============================================================================
-- Niveau 28 : indicateurs d'exploitation réservés au serveur de la plateforme.
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated, service_role;
grant usage on sequence results_n_seq to anon, authenticated, service_role;

create function pg_temp.record(p_test text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000002811', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin28ops@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000002811';

do $$
declare v_err text; v_metrics jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform public.ops_metrics();
  exception when others then v_err := sqlstate;
  end;
  execute 'reset role';
  perform pg_temp.record('un visiteur ne lit pas les indicateurs d''exploitation', v_err = '42501', v_err);

  v_err := null;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000002811', 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.ops_metrics();
  exception when others then v_err := sqlstate;
  end;
  execute 'reset role';
  perform pg_temp.record('ni un administrateur depuis le navigateur (clé du serveur seulement)', v_err = '42501', v_err);

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  v_metrics := public.ops_metrics();
  execute 'reset role';
  perform pg_temp.record('le serveur obtient volumes, files et échecs',
    v_metrics ? 'database_bytes' and v_metrics ? 'moderation_pending' and v_metrics ? 'cron_failed_24h' and v_metrics ? 'realtime_partition_today',
    left(v_metrics::text, 120));
  perform pg_temp.record('aucune donnée personnelle dans les indicateurs',
    v_metrics::text !~* '@|téléphone|phone|email', null);
  perform set_config('request.jwt.claims', '', true);
end $$;

select test, ok, detail from results order by n;
rollback;
