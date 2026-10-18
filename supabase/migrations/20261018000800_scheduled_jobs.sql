-- =============================================================================
-- Tâches planifiées (pg_cron).
--  * expiration des annonces arrivées à échéance (toutes les heures) ;
--  * purge des empreintes anti-abus de plus de 24 h (engagement de la
--    politique de confidentialité).
-- Idempotent : une tâche existante du même nom est remplacée.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.purge_rate_limits()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.rate_limit_buckets where window_start < now() - interval '24 hours';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('expirer-annonces', 'purger-anti-abus');
select cron.schedule('expirer-annonces', '15 * * * *', 'select public.expire_listings()');
select cron.schedule('purger-anti-abus', '45 * * * *', 'select public.purge_rate_limits()');
