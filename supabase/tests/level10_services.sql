-- =============================================================================
-- Niveau 10 : services de proximité (recherche, disponibilité datée, devis).
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
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pro10@test.invalid', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client10@test.invalid', '{}', now(), now());

insert into public.business_profiles (owner_id, slug, name, category_id, city_id, status, services, accepts_quotes, availability_note, phone)
select '00000000-0000-4000-8000-000000000101', v.slug, v.name, (select id from public.categories where slug = v.category),
       (select id from public.cities where is_default), 'published', v.services::text[], v.quotes, v.note, v.phone
from (values
  ('s10-clim', 'Zqxpro Froid Service', 'climatisation', '{"Entretien de climatiseurs"}', true, 'Disponible cette semaine', null),
  ('s10-plomb', 'Zqxpro Plomberie', 'plomberie', '{"Recherche de fuite"}', false, null, '0707000000')
) as v(slug, name, category, services, quotes, note, phone);

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_clim uuid := (select id from public.business_profiles where slug = 's10-clim');
  v_plomb uuid := (select id from public.business_profiles where slug = 's10-plomb');
  v_trade uuid[] := array[(select id from public.categories where slug = 'climatisation')];
  v_ids uuid[]; v_err text; v_declared timestamptz; v_keywords text[]; n int;
begin
  select keywords into v_keywords from public.categories where slug = 'climatisation';
  perform pg_temp.record('les métiers portent des mots-clés administrables', 'clim' = any (v_keywords), v_keywords::text);

  select availability_declared_at into v_declared from public.business_profiles where id = v_clim;
  perform pg_temp.record('la disponibilité déclarée est datée par la base', v_declared is not null, v_declared::text);

  perform pg_temp.act_as(null);
  select array_agg(id) into v_ids from public.search_professionals(v_city, v_trade, 'zqxpro');
  perform pg_temp.record('filtre par métier', v_ids = array[v_clim], v_ids::text);
  select array_agg(id) into v_ids from public.search_professionals(v_city, null, 'fuite');
  -- D'autres fiches (démonstration) peuvent aussi mentionner une fuite : on vérifie les fiches du test.
  perform pg_temp.record('recherche dans les prestations', v_plomb = any (v_ids) and not v_clim = any (v_ids), v_ids::text);
  select array_agg(id) into v_ids from public.search_professionals(v_city, null, 'zqxpro', p_available_days => 30);
  perform pg_temp.record('disponibilité déclarée récemment', v_ids = array[v_clim], v_ids::text);
  select array_agg(id) into v_ids from public.search_professionals(v_city, null, 'zqxpro', p_contact => 'devis');
  perform pg_temp.record('mode de contact : devis', v_ids = array[v_clim], v_ids::text);
  select array_agg(id) into v_ids from public.search_professionals(v_city, null, 'zqxpro', p_contact => 'telephone');
  perform pg_temp.record('mode de contact : téléphone', v_ids = array[v_plomb], v_ids::text);
  perform pg_temp.back();

  -- Devis
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000102');
  begin
    insert into public.contact_requests (kind, sender_id, recipient_id, business_id, sender_name, sender_phone, message)
    values ('devis', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000102', v_plomb, 'Client', '0101010101', 'Besoin d''un devis de plomberie.');
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('un professionnel qui refuse les devis n''en reçoit pas', v_err = '23514', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000102');
  insert into public.contact_requests (kind, sender_id, recipient_id, business_id, sender_name, sender_phone, message, details, consented_at)
  values ('devis', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000102', v_clim, 'Client', '0101010101',
          'Ma climatisation ne refroidit plus.', '{"prestation":"Réparation","quand":"semaine"}', now());
  perform pg_temp.back();

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000101');
  select count(*) into n from public.contact_requests where business_id = v_clim and consented_at is not null;
  perform pg_temp.back();
  perform pg_temp.record('le professionnel reçoit la demande, avec l''accord daté', n = 1, n::text);

  v_err := null;
  begin
    update public.contact_requests set consented_at = null where business_id = v_clim;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une demande de devis exige un accord de transmission', v_err = '23514', v_err);

  -- Suivi : le professionnel change le statut, jamais le contenu.
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000101');
  update public.contact_requests set status = 'replied' where business_id = v_clim;
  get diagnostics n = row_count;
  v_err := null;
  begin
    update public.contact_requests set message = 'Message réécrit par le destinataire.' where business_id = v_clim;
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.back();
  perform pg_temp.record('le professionnel met à jour le statut d''une demande reçue', n = 1, n::text);
  perform pg_temp.record('le professionnel ne peut pas modifier le contenu d''une demande', v_err = '42501', v_err);

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000102');
  update public.contact_requests set status = 'archived' where business_id = v_clim;
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('l''expéditeur ne change pas le statut d''une demande envoyée', n = 0, n::text);

  -- Référentiel des métiers : géré par l'administration (règle categories_admin_write), historisé.
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000101';
  perform pg_temp.act_as('00000000-0000-4000-8000-000000000101');
  update public.categories set keywords = keywords || '{zqxclim}'::text[] where slug = 'climatisation';
  get diagnostics n = row_count;
  insert into public.categories (parent_id, family, slug, name, content_types)
  select id, family, 'zqx-froid-industriel', 'Froid industriel', content_types from public.categories where slug = 'climatisation';
  perform pg_temp.back();
  perform pg_temp.record('un administrateur modifie les mots-clés d''un métier', n = 1, n::text);
  perform pg_temp.record('un administrateur ajoute une spécialité', exists (select 1 from public.categories where slug = 'zqx-froid-industriel'));
  perform pg_temp.record('la modification du référentiel est historisée',
    exists (select 1 from public.content_revisions r join public.categories c on c.id = r.entity_id where c.slug = 'climatisation' and r.after::text like '%zqxclim%'));

  perform pg_temp.act_as('00000000-0000-4000-8000-000000000102');
  update public.categories set name = 'Piratée' where slug = 'climatisation';
  get diagnostics n = row_count;
  perform pg_temp.back();
  perform pg_temp.record('un membre ne modifie pas le référentiel', n = 0, n::text);
end $$;

select test, ok, detail from results order by n;
rollback;
