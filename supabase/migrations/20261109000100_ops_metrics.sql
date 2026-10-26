-- =============================================================================
-- Niveau 28 : indicateurs d'exploitation (coûts, files d'attente, échecs).
-- Lus par la page /interne/statut avec la clé secrète du serveur, jamais par
-- le public ni par un membre. Aucune donnée personnelle : seulement des
-- volumes, des comptes et des âges.
-- =============================================================================

create or replace function public.ops_metrics()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if not public.is_service_request() then
    raise exception 'Réservé au serveur de la plateforme.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    -- Coûts : volume de la base et du stockage (facturés au-delà du forfait Supabase).
    'database_bytes', pg_database_size(current_database()),
    'storage', coalesce((
      select jsonb_object_agg(bucket_id, jsonb_build_object('objects', n, 'bytes', bytes))
      from (select bucket_id, count(*) as n, coalesce(sum((metadata ->> 'size')::bigint), 0) as bytes from storage.objects group by bucket_id) s
    ), '{}'::jsonb),
    'ai_cost_usd_month', (select coalesce(sum(cost_usd), 0) from public.ai_usage where created_at >= date_trunc('month', now())),
    'ai_calls_month', (select count(*) from public.ai_usage where created_at >= date_trunc('month', now())),
    -- Contenus
    'listings', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) as n from public.listings group by status) l), '{}'::jsonb),
    -- Files d'attente (alertes)
    'moderation_pending', (select count(*) from public.listings where status = 'pending')
                        + (select count(*) from public.events where status = 'pending')
                        + (select count(*) from public.business_profiles where status = 'pending'),
    'moderation_oldest_hours', (select round(extract(epoch from now() - min(updated_at)) / 3600)::integer from public.listings where status = 'pending'),
    'reports_open', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'appeals_open', (select count(*) from public.appeals where status = 'pending'),
    'deliveries_pending', (select count(*) from public.notification_deliveries where status = 'pending'),
    'deliveries_failed_24h', (select count(*) from public.notification_deliveries where status = 'failed' and created_at > now() - interval '1 day'),
    -- Tâches planifiées en échec sur 24 h
    'cron_failed_24h', (select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '1 day'),
    -- Temps réel : la partition du jour doit exister pour que la diffusion fonctionne
    'realtime_partition_today', to_regclass(format('realtime.messages_%s', to_char(now() at time zone 'utc', 'YYYY_MM_DD'))) is not null,
    'measured_at', now()
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function public.ops_metrics() from public, anon, authenticated;
grant execute on function public.ops_metrics() to service_role;
