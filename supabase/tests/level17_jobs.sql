-- =============================================================================
-- Niveau 17 : emploi (offres sans position, date limite, candidatures privées, profils candidats, recherche).
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


insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'employeur17@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'candidat17@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'curieux17@test.invalid', '{}', now(), now());
update public.profiles set role = 'professional', display_name = 'Zqj Employeur' where id = '00000000-0000-4000-8000-000000000801';
update public.profiles set display_name = 'Zqj Candidat' where id = '00000000-0000-4000-8000-000000000802';

-- Offres publiées (contexte système), sans position.
insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, attributes)
select '00000000-0000-4000-8000-000000000801', v.slug, v.title, repeat('Description de l''offre. ', 3),
       (select id from public.categories where slug = 'offres-emploi'), (select id from public.cities where is_default), 'published', v.attributes::jsonb
from (values
  ('j17-ouverte', 'Zqj Comptable', jsonb_build_object('contrat', 'cdi', 'domaine', 'finance', 'date_limite', to_char(current_date + 3, 'YYYY-MM-DD'))::text),
  ('j17-externe', 'Zqj Magasinier', '{"contrat":"cdd","domaine":"logistique","candidature":"externe","lien_candidature":"https://exemple.ci/postuler"}'),
  ('j17-close', 'Zqj Chauffeur', '{"contrat":"cdd","domaine":"logistique"}')
) as v(slug, title, attributes);
update public.listings set availability_status = 'unavailable' where slug = 'j17-close';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_employer uuid := '00000000-0000-4000-8000-000000000801';
  v_candidate uuid := '00000000-0000-4000-8000-000000000802';
  v_other uuid := '00000000-0000-4000-8000-000000000803';
  v_open uuid := (select id from public.listings where slug = 'j17-ouverte');
  v_external uuid := (select id from public.listings where slug = 'j17-externe');
  v_closed uuid := (select id from public.listings where slug = 'j17-close');
  v_jobs uuid[] := array(select id from public.categories where slug in ('offres-emploi', 'stages', 'missions-freelance'));
  v_application uuid; v_err text; n int; v_ids uuid[]; v_expires timestamptz;
begin
  perform pg_temp.record('une offre d''emploi se publie sans position', exists (select 1 from public.listings where id = v_open and status = 'published' and location is null));
  begin
    insert into public.listings (owner_id, slug, title, description, category_id, city_id, status)
    values (v_employer, 'j17-logement', 'Zqj Logement sans position', repeat('Description du bien. ', 3),
            (select id from public.categories where slug = 'immobilier-location'), v_city, 'pending');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un bien soumis sans position est toujours refusé', v_err = '23514', v_err);

  select expires_at into v_expires from public.listings where id = v_open;
  perform pg_temp.record('l''offre expire le lendemain de sa date limite', v_expires = (current_date + 4)::timestamp at time zone 'UTC', v_expires::text);
  v_err := null;
  begin
    update public.listings set attributes = attributes || jsonb_build_object('date_limite', to_char(current_date - 1, 'YYYY-MM-DD')) where id = v_open;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une date limite passée ne se publie pas', v_err = '23514', v_err);

  -- Candidatures
  perform pg_temp.act_as(v_candidate);
  insert into public.job_applications (listing_id, applicant_id, message) values (v_open, v_candidate, 'Ma candidature de test, assez longue pour être valide.')
  returning id into v_application;
  v_err := null;
  begin
    insert into public.job_applications (listing_id, applicant_id, message) values (v_closed, v_candidate, 'Candidature sur une offre close, refusée.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une offre close n''accepte plus de candidature', v_err = '23514', v_err);
  v_err := null;
  begin
    insert into public.job_applications (listing_id, applicant_id, message) values (v_external, v_candidate, 'Candidature interne sur une offre externe.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une offre à candidature externe n''accepte pas de candidature interne', v_err = '23514', v_err);
  v_err := null;
  begin
    update public.job_applications set status = 'shortlisted' where id = v_application;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('le candidat ne change pas lui-même le statut', v_err = '42501' or (select status from public.job_applications where id = v_application) = 'submitted', coalesce(v_err, 'inchangé'));
  perform pg_temp.record('l''employeur est notifié de la candidature',
    exists (select 1 from public.notifications where user_id = v_employer and type = 'candidature'));

  perform pg_temp.act_as(v_other);
  select count(*) into n from public.job_applications;
  perform pg_temp.back();
  perform pg_temp.record('les candidatures sont privées', n = 0, n::text);

  perform pg_temp.act_as(v_employer);
  select count(*) into n from public.received_applications() where applicant_name = 'Zqj Candidat';
  v_err := null;
  begin
    update public.job_applications set message = 'Message réécrit par l''employeur.' where id = v_application;
  exception when others then v_err := sqlstate;
  end;
  update public.job_applications set status = 'shortlisted' where id = v_application;
  perform pg_temp.back();
  perform pg_temp.record('l''employeur voit les candidatures reçues', n = 1, n::text);
  perform pg_temp.record('l''employeur ne modifie pas une candidature', v_err = '42501', v_err);
  perform pg_temp.record('le candidat est notifié de la décision (humaine)',
    exists (select 1 from public.notifications where user_id = v_candidate and title like 'Candidature retenue%'));

  -- Profil candidat
  perform pg_temp.act_as(v_candidate);
  insert into public.candidate_profiles (user_id, headline, contact_email, share_contact) values (v_candidate, 'Comptable, 3 ans d''expérience', 'zqj@test.invalid', true);
  perform pg_temp.back();
  perform pg_temp.record('profil candidat privé par défaut', (select visibility from public.candidate_profiles where user_id = v_candidate) = 'private');
  perform pg_temp.act_as(v_employer);
  select count(*) into n from public.candidate_profiles where user_id = v_candidate;
  perform pg_temp.back();
  perform pg_temp.record('un profil privé n''est vu par aucun employeur', n = 0, n::text);

  update public.candidate_profiles set visibility = 'employers' where user_id = v_candidate;
  perform pg_temp.act_as(v_employer);
  select count(*) into n from public.candidate_profiles where user_id = v_candidate;
  perform pg_temp.record('visibilité « employeurs » : vu par un compte employeur', n = 1, n::text);
  perform pg_temp.record('coordonnées révélées seulement si le candidat les partage',
    (select contact_email from public.reveal_candidate_contact(v_candidate)) = 'zqj@test.invalid');
  v_err := null;
  begin
    perform contact_email from public.candidate_profiles where user_id = v_candidate;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('les coordonnées ne se lisent jamais directement', v_err = '42501', v_err);
  perform pg_temp.act_as(v_other);
  select count(*) into n from public.candidate_profiles where user_id = v_candidate;
  perform pg_temp.back();
  perform pg_temp.record('un membre non employeur ne voit pas un profil « employeurs »', n = 0, n::text);

  -- Recherche
  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_jobs(v_city, v_jobs, 'zqj');
  perform pg_temp.record('recherche : offres ouvertes seulement (close exclue)', v_open = any (v_ids) and v_external = any (v_ids) and not v_closed = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_jobs(v_city, v_jobs, 'zqj', p_contract => 'cdi');
  perform pg_temp.record('filtre par contrat', v_ids = array[v_open], v_ids::text);
  select array_agg(id) into v_ids from public.search_jobs(v_city, v_jobs, 'zqj', p_domain => 'logistique');
  perform pg_temp.record('filtre par domaine', v_ids = array[v_external], v_ids::text);
  perform pg_temp.back();

  -- Clôture par l'employeur : l'offre reste publiée (pas de remise en modération).
  perform pg_temp.act_as(v_employer);
  update public.listings set availability_status = 'unavailable' where id = v_external;
  perform pg_temp.back();
  perform pg_temp.record('clôturer une offre ne la renvoie pas en modération',
    (select status = 'published' and availability_status = 'unavailable' from public.listings where id = v_external));
  perform pg_temp.act_as(v_employer);
  update public.listings set title = title || ' (modifiée)' where id = v_open;
  perform pg_temp.back();
  perform pg_temp.record('modifier le texte d''une offre la renvoie en modération', (select status from public.listings where id = v_open) = 'pending');
end $$;

select test, ok, detail from results order by n;
rollback;
