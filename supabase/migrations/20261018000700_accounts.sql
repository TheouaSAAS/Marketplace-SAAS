-- =============================================================================
-- Niveau 3 : comptes.
--  * inscription : préférences et consentements enregistrés avec le profil ;
--  * transitions particulier ↔ professionnel contrôlées et journalisées ;
--  * limitation de débit (anti-abus) réservée au serveur ;
--  * export des données personnelles ;
--  * suppression de compte possible (références pseudonymisées si conservation requise).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Inscription
-- Métadonnées attendues (posées par l'action serveur d'inscription, après validation) :
--   display_name, account_intent ('particulier'|'professionnel'),
--   consents: { "terms": "<version>", "privacy": "<version>", "marketing_email": true|false }
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := btrim(coalesce(v_meta ->> 'display_name', ''));
  v_intent text := case when v_meta ->> 'account_intent' = 'professionnel' then 'professionnel' else 'particulier' end;
  v_consents jsonb := coalesce(v_meta -> 'consents', '{}'::jsonb);
begin
  insert into public.profiles (id, display_name)
  values (new.id, case when char_length(v_name) between 2 and 80 then v_name end);

  insert into public.user_preferences (user_id, account_intent) values (new.id, v_intent);

  if v_consents ? 'terms' then
    insert into public.consents (user_id, kind, granted, document_version)
    values (new.id, 'terms', true, left(v_consents ->> 'terms', 20));
  end if;
  if v_consents ? 'privacy' then
    insert into public.consents (user_id, kind, granted, document_version)
    values (new.id, 'privacy', true, left(v_consents ->> 'privacy', 20));
  end if;
  if v_consents ? 'marketing_email' then
    insert into public.consents (user_id, kind, granted, document_version)
    values (new.id, 'marketing_email', coalesce((v_consents ->> 'marketing_email')::boolean, false), left(coalesce(v_consents ->> 'privacy', 'n/a'), 20));
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Particulier ↔ professionnel
-- -----------------------------------------------------------------------------
create or replace function public.become_professional()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'Confirmez d''abord votre adresse e-mail.' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'user' then
    raise exception 'Ce compte n''est pas un compte particulier.' using errcode = '23514';
  end if;
  update public.profiles set role = 'professional' where id = v_uid;
  update public.user_preferences set account_intent = 'professionnel' where user_id = v_uid;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'account.become_professional', 'profile', v_uid, jsonb_build_object('from', 'user', 'to', 'professional'));
end;
$$;

create or replace function public.become_individual()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if (select role from public.profiles where id = v_uid) is distinct from 'professional' then
    raise exception 'Ce compte n''est pas un compte professionnel.' using errcode = '23514';
  end if;
  if exists (select 1 from public.organization_members where user_id = v_uid and role = 'owner') then
    raise exception 'Transférez d''abord la propriété de vos organisations.' using errcode = '23514';
  end if;
  update public.profiles set role = 'user' where id = v_uid;
  update public.user_preferences set account_intent = 'particulier' where user_id = v_uid;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'account.become_individual', 'profile', v_uid, jsonb_build_object('from', 'professional', 'to', 'user'));
end;
$$;
revoke execute on function public.become_professional() from public, anon;
revoke execute on function public.become_individual() from public, anon;
grant execute on function public.become_professional() to authenticated;
grant execute on function public.become_individual() to authenticated;

-- -----------------------------------------------------------------------------
-- Limitation de débit. Clés = empreintes calculées par le serveur (jamais d'IP en clair).
-- Appelée uniquement avec la clé secrète : un client ne peut ni consulter ni épuiser les compteurs.
-- -----------------------------------------------------------------------------
create table public.rate_limit_buckets (
  key_hash text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limit_buckets enable row level security;
create policy rate_limit_buckets_none on public.rate_limit_buckets for select using (false);
revoke all on public.rate_limit_buckets from anon, authenticated;

create or replace function public.consume_rate_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limit_buckets as b (key_hash, window_start, hits)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
    set hits = case when b.window_start < now() - make_interval(secs => p_window_seconds) then 1 else b.hits + 1 end,
        window_start = case when b.window_start < now() - make_interval(secs => p_window_seconds) then now() else b.window_start end
  returning hits into v_hits;

  -- Nettoyage opportuniste des compteurs anciens.
  if random() < 0.01 then
    delete from public.rate_limit_buckets where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- -----------------------------------------------------------------------------
-- Export des données personnelles (droit d'accès et de portabilité)
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exporte_le', now(),
    'compte', (select jsonb_build_object('email', u.email, 'cree_le', u.created_at, 'email_confirme_le', u.email_confirmed_at)
               from auth.users u where u.id = v_uid),
    'profil', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'preferences', (select to_jsonb(x) from public.user_preferences x where x.user_id = v_uid),
    'consentements', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from public.consents x where x.user_id = v_uid), '[]'),
    'annonces', coalesce((select jsonb_agg(to_jsonb(x) - 'search_vector' - 'location' - 'location_public') from public.listings x where x.owner_id = v_uid), '[]'),
    'favoris', coalesce((select jsonb_agg(to_jsonb(x)) from public.favorites x where x.user_id = v_uid), '[]'),
    'recherches_sauvegardees', coalesce((select jsonb_agg(to_jsonb(x)) from public.saved_searches x where x.user_id = v_uid), '[]'),
    'avis', coalesce((select jsonb_agg(to_jsonb(x)) from public.reviews x where x.author_id = v_uid), '[]'),
    'candidatures', coalesce((select jsonb_agg(to_jsonb(x)) from public.job_applications x where x.applicant_id = v_uid), '[]'),
    'demandes_de_contact_envoyees', coalesce((select jsonb_agg(to_jsonb(x)) from public.contact_requests x where x.sender_id = v_uid), '[]'),
    'messages_envoyes', coalesce((select jsonb_agg(to_jsonb(x)) from public.messages x where x.sender_id = v_uid), '[]'),
    'organisations', coalesce((select jsonb_agg(jsonb_build_object('organisation', o.name, 'role', m.role))
                               from public.organization_members m join public.organizations o on o.id = m.organization_id
                               where m.user_id = v_uid), '[]'),
    'parcours_nouvel_arrivant', (select to_jsonb(x) from public.newcomer_plans x where x.user_id = v_uid),
    'signalements', coalesce((select jsonb_agg(to_jsonb(x)) from public.reports x where x.reporter_id = v_uid), '[]')
  );
end;
$$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- -----------------------------------------------------------------------------
-- Suppression de compte : les références qui doivent survivre sont pseudonymisées.
-- -----------------------------------------------------------------------------
-- Fiches de lieux : conservées (donnée locale), créateur effacé.
alter table public.places alter column created_by drop not null;
alter table public.places drop constraint places_created_by_fkey;
alter table public.places add constraint places_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Organisations : conservées si d'autres membres existent ; créateur effacé.
alter table public.organizations alter column created_by drop not null;
alter table public.organizations drop constraint organizations_created_by_fkey;
alter table public.organizations add constraint organizations_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Paiements : conservation comptable, lien au compte effacé.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;
