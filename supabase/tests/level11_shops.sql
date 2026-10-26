-- =============================================================================
-- Niveau 11 : commerces (horaires sourcés, recherche, revendication,
-- messagerie, « j'aime », mise en avant sponsorisée).
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
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membre11@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client11@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'exploitant11@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'editeur11@test.invalid', '{}', now(), now());
update public.profiles set role = 'local_editor' where id = '00000000-0000-4000-8000-000000000204';

insert into public.sources (kind, title, collected_at) values ('terrain', 'Zqx relevé terrain', current_date);

insert into public.places (kind, created_by, slug, name, category_id, city_id, status, verification_status,
                           price_level, features, ambiance, products, opening_hours, opening_hours_verified_at, opening_hours_source_id)
select 'etablissement', '00000000-0000-4000-8000-000000000201', v.slug, v.name, (select id from public.categories where slug = v.category),
       (select id from public.cities where is_default), 'published', 'pending_validation',
       v.price, v.features::text[], v.ambiance::text[], v.products::text[], v.hours::jsonb,
       case when v.hours is not null then now() end,
       case when v.hours is not null then (select id from public.sources where title = 'Zqx relevé terrain') end
from (values
  ('s11-resto', 'Zqxshop Maquis', 'restaurants-gastronomie', 1, '{sur_place,paiement_mobile}', '{familiale}', '{"Poisson braisé"}', '{"lun":[["11:00","15:00"]]}'),
  ('s11-quinc', 'Zqxshop Quincaillerie', 'quincaillerie-materiaux', 3, '{livraison}', '{}', '{"Ciment","Fer à béton"}', null)
) as v(slug, name, category, price, features, ambiance, products, hours);

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_resto uuid := (select id from public.places where slug = 's11-resto');
  v_quinc uuid := (select id from public.places where slug = 's11-quinc');
  v_claim uuid; v_ids uuid[]; v_err text; v_verified timestamptz; v_uuid uuid; n int; v_likes bigint;
begin
  perform pg_temp.record('une vue « auto, moto et pièces » est ajoutée au référentiel',
    exists (select 1 from public.categories c join public.categories p on p.id = c.parent_id where c.slug = 'auto-moto' and p.slug = 'commerces-boutiques'));
  perform pg_temp.record('horaires valides acceptés', public.valid_opening_hours('{"lun":[["08:00","12:30"],["14:00","24:00"]],"dim":[]}'));
  perform pg_temp.record('horaires invalides refusés (jour, format, fin avant début)',
    not public.valid_opening_hours('{"lundi":[["08:00","12:00"]]}') and not public.valid_opening_hours('{"lun":[["8h","12h"]]}')
    and not public.valid_opening_hours('{"lun":[["14:00","09:00"]]}'));

  -- Recherche
  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_shops(v_city, null, 'zqxshop', p_budget_max => 1::smallint);
  perform pg_temp.record('filtre budget indicatif', v_ids = array[v_resto], v_ids::text);
  select array_agg(id) into v_ids from public.search_shops(v_city, null, 'zqxshop', p_ambiance => '{familiale,calme}');
  perform pg_temp.record('filtre ambiance (au moins une)', v_ids = array[v_resto], v_ids::text);
  select array_agg(id) into v_ids from public.search_shops(v_city, null, 'zqxshop', p_features => '{livraison}');
  perform pg_temp.record('filtre services (tous requis)', v_ids = array[v_quinc], v_ids::text);
  select array_agg(id) into v_ids from public.search_shops(v_city, array[(select id from public.categories where slug = 'quincaillerie-materiaux')], null);
  perform pg_temp.record('filtre par type de commerce', v_quinc = any (v_ids) and not v_resto = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_shops(v_city, null, 'ciment');
  perform pg_temp.record('recherche dans les produits', v_quinc = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_shops(v_city, null, 'zqxshop');
  perform pg_temp.record('les horaires vérifiés passent devant à vérification égale', v_ids = array[v_resto, v_quinc], v_ids::text);
  perform pg_temp.back();

  -- Horaires et gérant : réservés à l'équipe locale
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000201');
  update public.places set opening_hours = '{"lun":[["10:00","16:00"]]}' where id = v_resto;
  perform pg_temp.back();
  select opening_hours_verified_at into v_verified from public.places where id = v_resto;
  perform pg_temp.record('des horaires modifiés hors équipe locale repassent « à confirmer »', v_verified is null, v_verified::text);
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000201');
  begin
    update public.places set manager_id = '00000000-0000-4000-8000-000000000201' where id = v_resto;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne se désigne pas gérant', v_err = '42501', v_err);
  -- La modification par l'auteur renvoie la fiche en modération : l'équipe la republie.
  perform pg_temp.record('une fiche modifiée par son auteur repasse en modération',
    (select status from public.places where id = v_resto) <> 'published', (select status::text from public.places where id = v_resto));
  update public.places set status = 'published' where id = v_resto;

  -- Messagerie impossible tant que la vitrine n'est pas revendiquée
  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000202');
  begin
    perform public.start_place_conversation(v_resto, 'Bonjour, êtes-vous ouverts ?');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('pas de messagerie vers une vitrine sans exploitant', v_err = '23514', v_err);

  -- Revendication
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000203');
  insert into public.place_claims (place_id, claimant_id, claimant_role, message, evidence, phone, status)
  values (v_resto, '00000000-0000-4000-8000-000000000203', 'gerant', 'Je gère ce maquis depuis 2020.', 'RCCM CI-SPY-0000', '0700000000', 'approved')
  returning id into v_claim;
  v_err := null;
  begin
    insert into public.place_claims (place_id, claimant_id, claimant_role, message, evidence, phone)
    values (v_resto, '00000000-0000-4000-8000-000000000203', 'gerant', 'Deuxième demande identique.', 'RCCM', '0700000000');
  exception when others then v_err := sqlstate;
  end;
  update public.place_claims set status = 'approved' where id = v_claim;
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('une revendication est créée « en attente », quel que soit le statut envoyé',
    (select status from public.place_claims where id = v_claim) = 'pending');
  perform pg_temp.record('une seule revendication en attente par vitrine et par personne', v_err = '23505', v_err);
  perform pg_temp.record('le demandeur ne valide pas sa propre revendication', n = 0, n::text);

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000202');
  begin
    perform public.review_place_claim(v_claim, true);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne décide pas d''une revendication', v_err = '42501', v_err);

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000204');
  begin
    perform public.review_place_claim(v_claim, false, '');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('un refus doit être motivé', v_err = '23514', v_err);
  perform public.review_place_claim(v_claim, true, 'Registre vérifié en mairie.');
  perform pg_temp.back();
  perform pg_temp.record('l''équipe locale valide : l''exploitant devient gérant',
    (select manager_id from public.places where id = v_resto) = '00000000-0000-4000-8000-000000000203');
  perform pg_temp.record('l''exploitant est notifié de la décision',
    exists (select 1 from public.notifications where user_id = '00000000-0000-4000-8000-000000000203' and type = 'revendication'));

  v_err := null;
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000202');
  begin
    insert into public.place_claims (place_id, claimant_id, claimant_role, message, evidence, phone)
    values (v_resto, '00000000-0000-4000-8000-000000000202', 'proprietaire', 'C''est mon restaurant.', 'Aucune', '0101010101');
  exception when others then v_err := sqlstate;
  end;
  v_uuid := public.start_place_conversation(v_resto, 'Bonjour, livrez-vous à Bardot ?');
  insert into public.place_likes (place_id, user_id) values (v_resto, '00000000-0000-4000-8000-000000000202');
  select likes into v_likes from public.place_engagement(v_resto);
  perform pg_temp.back();
  perform pg_temp.record('une vitrine déjà gérée ne se revendique plus', v_err = '23514', v_err);
  perform pg_temp.record('après validation, un client écrit à l''exploitant',
    exists (select 1 from public.conversation_participants where conversation_id = v_uuid and user_id = '00000000-0000-4000-8000-000000000203'));
  perform pg_temp.record('« j''aime » sur une vitrine, total public', v_likes = 1, v_likes::text);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000203');
  select count(*) into n from public.my_conversations() where place_slug = 's11-resto';
  perform pg_temp.back();
  perform pg_temp.record('la conversation porte le nom de la vitrine', n = 1, n::text);

  -- Mise en avant sponsorisée : seulement une campagne active et en cours
  insert into public.sponsored_campaigns (owner_id, place_id, placement, city_id, starts_at, ends_at, budget_xof, status)
  values ('00000000-0000-4000-8000-000000000203', v_resto, 'category', v_city, now() - interval '1 day', now() + interval '1 day', 0, 'draft'),
         ('00000000-0000-4000-8000-000000000201', v_quinc, 'category', v_city, now() - interval '1 day', now() + interval '1 day', 0, 'active');
  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.sponsored_shops(v_city, null, 4);
  perform pg_temp.back();
  perform pg_temp.record('seule une campagne active est mise en avant', v_quinc = any (v_ids) and not v_resto = any (coalesce(v_ids, '{}')), v_ids::text);
end $$;

select test, ok, detail from results order by n;
rollback;
