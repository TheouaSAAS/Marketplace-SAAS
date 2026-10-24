-- =============================================================================
-- Hygiène des données de test (niveau 27) : les tests ne laissent rien en base.
-- - tests SQL : transactions annulées, préfixes « Zq… » ;
-- - tests de bout en bout : comptes « e2e-…@test.invalid » et contenus « Zqe2e… »
--   supprimés en fin d'exécution (orphelins supprimés au démarrage suivant).
-- Seuls les restes de plus d'un jour sont signalés (une exécution peut être en cours).
-- Les exemples de démonstration sont distincts : statut « placeholder », titre « Exemple — … ».
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);

do $$
declare
  n int;
  v_old timestamptz := now() - interval '1 day';
begin
  select count(*) into n from auth.users where email like '%@test.invalid' and created_at < v_old;
  insert into results (test, ok, detail) values ('aucun compte de test oublié', n = 0, n::text);

  select (select count(*) from public.listings where (title like 'Zq%' or slug like 'zq%') and created_at < v_old)
       + (select count(*) from public.places where (name like 'Zq%' or slug like 'zq%') and created_at < v_old)
       + (select count(*) from public.events where (title like 'Zq%' or slug like 'zq%') and created_at < v_old)
       + (select count(*) from public.business_profiles where (name like 'Zq%' or slug like 'zq%') and created_at < v_old)
       + (select count(*) from public.organizations where (name like 'Zq%' or slug like 'zq%') and created_at < v_old)
       + (select count(*) from public.sources where title like 'Zq%' and created_at < v_old)
  into n;
  insert into results (test, ok, detail) values ('aucun contenu de test oublié', n = 0, n::text);

  select (select count(*) from public.listings where verification_status = 'placeholder' and title not like 'Exemple —%')
       + (select count(*) from public.places where verification_status = 'placeholder' and name not like 'Exemple —%')
       + (select count(*) from public.events where verification_status = 'placeholder' and title not like 'Exemple —%')
       + (select count(*) from public.business_profiles where verification_status = 'placeholder' and name not like 'Exemple —%')
       + (select count(*) from public.guide_articles where verification_status = 'placeholder' and title not like 'Exemple —%')
  into n;
  insert into results (test, ok, detail) values ('chaque exemple de démonstration est nommé « Exemple — … »', n = 0, n::text);

  select (select count(*) from public.listings where title like 'Exemple —%' and verification_status <> 'placeholder')
       + (select count(*) from public.places where name like 'Exemple —%' and verification_status <> 'placeholder')
  into n;
  insert into results (test, ok, detail) values ('aucun exemple présenté comme vérifié', n = 0, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
