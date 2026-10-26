-- =============================================================================
-- Connexion, inscription et accès à l'administration.
--
-- 1. Second facteur du back-office : un rôle de modération, d'édition locale ou
--    d'administration n'agit qu'avec une session « aal2 » (second facteur TOTP
--    vérifié par Supabase Auth). Sans elle, le compte agit comme un simple
--    membre, partout en base (toutes les règles passent par current_user_role).
--    Réglage `security.backoffice_mfa` (activé par défaut).
-- 2. Inscription professionnelle : nom de l'activité et secteur conservés pour
--    préremplir la future page (jamais publiée sans complétude ni modération).
-- 3. Journal des accès à l'administration (connexions, échecs, refus,
--    second facteur, déconnexions) : aucun mot de passe, jeton ni adresse en clair.
-- =============================================================================

-- 1. Second facteur -----------------------------------------------------------
insert into public.platform_settings (key, value, description, is_public)
values ('security.backoffice_mfa', '{"enabled": true}',
        'Second facteur obligatoire pour les rôles du back-office (modération, édition locale, administration).', false)
on conflict (key) do nothing;

create or replace function public.backoffice_mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'security.backoffice_mfa'), true)
$$;
revoke execute on function public.backoffice_mfa_required() from public, anon;
grant execute on function public.backoffice_mfa_required() to authenticated, service_role;

-- Rôle EFFECTIF de la personne connectée : un rôle du back-office sans second
-- facteur vérifié vaut « user ». Le rôle attribué (profiles.role) est inchangé.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role in ('local_editor', 'moderator', 'admin', 'superadmin')
         and coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2'
         and public.backoffice_mfa_required()
      then 'user'::public.user_role
    else p.role
  end
  from public.profiles p
  where p.id = (select auth.uid())
$$;

-- 2. Inscription professionnelle ----------------------------------------------
alter table public.user_preferences
  add column pending_business_name text check (pending_business_name is null or char_length(pending_business_name) between 2 and 120),
  add column pending_business_category uuid references public.categories (id) on delete set null;

comment on column public.user_preferences.pending_business_name is
  'Nom de l''activité déclaré à l''inscription : préremplit la page professionnelle, jamais publiée automatiquement.';

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
  v_business_name text := btrim(coalesce(v_meta #>> '{business,name}', ''));
  v_business_category uuid;
begin
  -- Aucun rôle n'est lu dans les métadonnées : un compte public naît toujours « user ».
  insert into public.profiles (id, display_name)
  values (new.id, case when char_length(v_name) between 2 and 80 then v_name end);

  if v_intent = 'professionnel' then
    select c.id into v_business_category
    from public.categories c
    where c.id::text = v_meta #>> '{business,category_id}' and c.is_active and 'business' = any (c.content_types);
  end if;

  insert into public.user_preferences (user_id, account_intent, pending_business_name, pending_business_category)
  values (new.id, v_intent,
          case when v_intent = 'professionnel' and char_length(v_business_name) between 2 and 120 then v_business_name end,
          v_business_category);

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

-- 3. Journal des accès à l'administration --------------------------------------
create table public.admin_access_log (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in ('connexion', 'echec', 'refus', 'second_facteur_echec', 'second_facteur_active', 'deconnexion')),
  -- Compte concerné quand il est connu (jamais pour un échec : on ne révèle pas qu'une adresse existe).
  user_id uuid references public.profiles (id) on delete set null,
  -- Empreintes HMAC (adresse visée, adresse IP) : regroupent les échecs répétés sans conserver de donnée en clair.
  email_fingerprint text check (email_fingerprint is null or email_fingerprint ~ '^[0-9a-f]{64}$'),
  ip_fingerprint text check (ip_fingerprint is null or ip_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index admin_access_log_created_idx on public.admin_access_log (created_at desc);
create index admin_access_log_email_idx on public.admin_access_log (email_fingerprint, created_at desc) where email_fingerprint is not null;
alter table public.admin_access_log enable row level security;
-- Lecture : administrateurs (second facteur compris) ; écriture : serveur de la plateforme uniquement.
create policy admin_access_log_admin_read on public.admin_access_log for select to authenticated using ((select public.is_admin()));
revoke all on public.admin_access_log from anon, authenticated;
grant select on public.admin_access_log to authenticated;

-- Conservation : un an.
select cron.schedule('purger-acces-administration', '50 3 * * *', $$delete from public.admin_access_log where created_at < now() - interval '1 year'$$);
