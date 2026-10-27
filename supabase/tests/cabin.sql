-- =============================================================================
-- Cabine en ligne : frais, idempotence, aucune réussite sans prestataire,
-- droits d'accès, suivi par jeton. Transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated, service_role;
grant usage on sequence results_n_seq to anon, authenticated, service_role;

create function pg_temp.act_as(p_uid uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
    execute 'set local role authenticated';
  end if;
end $$;
create function pg_temp.as_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
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
  ('00000000-0000-4000-8000-000000003001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client30@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000003002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'autre30@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000003003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin30@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000003004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'modo30@test.invalid', '{}', now(), now(), now());
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000003003';
update public.profiles set role = 'moderator' where id = '00000000-0000-4000-8000-000000003004';

do $$
declare
  v_client uuid := '00000000-0000-4000-8000-000000003001';
  v_other uuid := '00000000-0000-4000-8000-000000003002';
  v_admin uuid := '00000000-0000-4000-8000-000000003003';
  v_modo uuid := '00000000-0000-4000-8000-000000003004';
  v_fp text := repeat('ab', 32);
  v_token text := repeat('cd', 32);
  v_key uuid := gen_random_uuid();
  v_row record; v_again record; v_live record;
  v_err text; v_hint text; n int; v_status public.cabin_status;
begin
  -- Frais : 0,5 % arrondi au franc entier le plus proche (demi-franc vers le haut).
  perform pg_temp.record('10 000 F CFA : 50 F de frais', public.cabin_fee(10000, 50) = 50);
  perform pg_temp.record('arrondi au franc le plus proche (299 → 1, 300 → 2, 100 → 1, 1 → 0)',
    public.cabin_fee(299, 50) = 1 and public.cabin_fee(300, 50) = 2 and public.cabin_fee(100, 50) = 1 and public.cabin_fee(1, 50) = 0);

  -- Référentiel : rien d'inventé.
  select count(*) into n from public.cabin_networks where kind = 'mobile_money';
  perform pg_temp.record('les quatre portefeuilles demandés sont présents', n = 4 and exists (select 1 from public.cabin_networks where code = 'wave'), n::text);
  select count(*) into n from public.cabin_transfer_routes where is_enabled;
  perform pg_temp.record('aucune combinaison de transfert activée sans prestataire', n = 0 and (select count(*) from public.cabin_transfer_routes) = 12, n::text);
  perform pg_temp.record('aucune offre Internet fabriquée', not exists (select 1 from public.cabin_offers));
  perform pg_temp.record('frais par défaut : 0,5 % pour chaque service', not exists (select 1 from public.cabin_service_settings where fee_bps <> 50));

  -- Accès du public
  perform pg_temp.act_as(null);
  select count(*) into n from public.cabin_networks;
  perform pg_temp.record('le public lit les réseaux et services', n >= 8, n::text);
  v_err := null;
  begin
    perform 1 from public.cabin_operations;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('le public ne lit aucune opération', v_err = '42501', v_err);
  v_err := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 1000, 1005, now() + interval '10 minutes', false);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('ni ne crée une opération sans passer par le serveur', v_err = '42501', v_err);
  perform pg_temp.back();

  -- Création par le serveur : démonstration, jamais réussie.
  perform pg_temp.as_server();
  select * into v_row from public.create_cabin_operation(v_key, v_token, v_client, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 10000, 10050, now() + interval '10 minutes', false);
  select * into v_again from public.create_cabin_operation(v_key, v_token, v_client, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 10000, 10050, now() + interval '10 minutes', false);
  perform pg_temp.back();
  perform pg_temp.record('opération de démonstration : 10 000 + 50 = 10 050, annulée, jamais réussie',
    v_row.mode = 'demo' and v_row.status = 'cancelled' and v_row.total_xof = 10050 and v_row.created, v_row.status::text);
  perform pg_temp.record('une seconde confirmation ne crée pas de seconde opération',
    v_again.id = v_row.id and not v_again.created and (select count(*) from public.cabin_operations where idempotency_key = v_key) = 1);

  perform pg_temp.as_server();
  v_hint := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 10000, 10000, now() + interval '10 minutes', false);
  exception when others then get stacked diagnostics v_hint = pg_exception_hint;
  end;
  perform pg_temp.record('un total différent du calcul exige une nouvelle confirmation', v_hint = 'MONTANT_CHANGE', v_hint);
  v_hint := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 10000, 10050, now() - interval '1 minute', false);
  exception when others then get stacked diagnostics v_hint = pg_exception_hint;
  end;
  perform pg_temp.record('un récapitulatif expiré est refusé', v_hint = 'DEVIS_EXPIRE', v_hint);
  v_hint := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'electricity', 'orange', null, null, '1234****', v_fp, 5000, 5025, now() + interval '10 minutes', false);
  exception when others then get stacked diagnostics v_hint = pg_exception_hint;
  end;
  perform pg_temp.record('un réseau incompatible avec le service est refusé', v_hint = 'RESEAU_INCOMPATIBLE', v_hint);
  v_hint := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'airtime', 'orange', null, null, '07 ** ** ** 12', v_fp, 10, 10, now() + interval '10 minutes', false);
  exception when others then get stacked diagnostics v_hint = pg_exception_hint;
  end;
  perform pg_temp.record('montant hors limites refusé', v_hint = 'MONTANT_HORS_LIMITES', v_hint);
  v_hint := null;
  begin
    perform public.create_cabin_operation(gen_random_uuid(), v_token, null, 'data', 'orange', null, gen_random_uuid(), '07 ** ** ** 12', v_fp, 500, 503, now() + interval '10 minutes', false);
  exception when others then get stacked diagnostics v_hint = pg_exception_hint;
  end;
  perform pg_temp.record('une offre inexistante est refusée', v_hint = 'OFFRE_INDISPONIBLE', v_hint);

  v_err := null;
  begin
    perform public.set_cabin_status(v_row.id, 'succeeded', 'prestataire', 'Confirmation simulée', 'REF-FAUSSE');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une opération de démonstration ne devient jamais « réussie »', v_err = '23514', v_err);
  v_err := null;
  begin
    update public.cabin_operations set delivery_code = '1234-5678-9012' where id = v_row.id;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('aucun code de recharge en démonstration', v_err = '23514', v_err);

  -- Suivi par jeton
  select count(*) into n from public.cabin_operation_status(v_row.reference, v_token);
  perform pg_temp.record('le jeton de suivi donne l''état', n = 1);
  select count(*) into n from public.cabin_operation_status(v_row.reference, repeat('ef', 32));
  perform pg_temp.record('un autre jeton ne donne rien', n = 0);
  perform pg_temp.back();

  -- Mode réel (prestataire de test) : succès seulement avec la référence du prestataire.
  insert into public.cabin_providers (code, name, services, mode, is_active) values ('zq_test', 'Zq Prestataire', '{airtime}', 'live', true);
  update public.cabin_service_settings set provider_code = 'zq_test' where service = 'airtime';
  perform pg_temp.as_server();
  select * into v_live from public.create_cabin_operation(gen_random_uuid(), v_token, v_other, 'airtime', 'mtn', null, null, '05 ** ** ** 34', v_fp, 2000, 2010, now() + interval '10 minutes', true);
  perform pg_temp.record('avec un prestataire réel et son intégration, l''opération est en attente', v_live.mode = 'live' and v_live.status = 'pending', v_live.status::text);
  v_err := null;
  begin
    perform public.set_cabin_status(v_live.id, 'succeeded', 'prestataire', 'Sans référence');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('pas de réussite sans référence du prestataire', v_err = '23514', v_err);
  perform public.set_cabin_status(v_live.id, 'awaiting_confirmation', 'prestataire', 'Résultat incertain');
  v_status := public.set_cabin_status(v_live.id, 'awaiting_confirmation', 'prestataire', 'Notification répétée');
  select count(*) into n from public.cabin_operation_events where operation_id = v_live.id and to_status = 'awaiting_confirmation';
  perform pg_temp.record('une notification répétée n''a aucun effet', n = 1, n::text);
  perform pg_temp.back();

  -- Rapprochement : administrateur avec second facteur seulement, raison obligatoire, journalisé.
  perform pg_temp.act_as(v_modo);
  v_err := null;
  begin
    perform public.set_cabin_status(v_live.id, 'failed', 'administration', 'Échec constaté chez le prestataire');
  exception when others then v_err := sqlstate;
  end;
  select count(*) into n from public.cabin_operations;
  perform pg_temp.back();
  perform pg_temp.record('la modération ne rapproche pas et ne voit aucune opération', v_err = '42501' and n = 0, v_err || ' / ' || n);
  perform pg_temp.act_as(v_admin, 'aal1');
  v_err := null;
  begin
    perform public.set_cabin_status(v_live.id, 'failed', 'administration', 'Échec constaté chez le prestataire');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un administrateur sans second facteur non plus', v_err = '42501', v_err);
  perform pg_temp.act_as(v_admin);
  v_status := public.set_cabin_status(v_live.id, 'succeeded', 'administration', 'Confirmé par le relevé du prestataire', 'PRV-123456');
  perform pg_temp.back();
  perform pg_temp.record('rapprochement : réussite avec la référence du prestataire, journalisée',
    v_status = 'succeeded' and exists (select 1 from public.admin_audit_log where action = 'cabine.rapprochement' and entity_id = v_live.id));

  -- Historique : chacun ses opérations.
  perform pg_temp.act_as(v_client);
  select count(*) into n from public.cabin_operations;
  perform pg_temp.record('une personne connectée ne voit que ses opérations', n = 1, n::text);
  v_err := null;
  begin
    update public.cabin_operations set status = 'refunded' where user_id = v_client;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('et ne peut pas les modifier', v_err = '42501', v_err);
  perform pg_temp.back();
end $$;

select test, ok, detail from results order by n;
rollback;
