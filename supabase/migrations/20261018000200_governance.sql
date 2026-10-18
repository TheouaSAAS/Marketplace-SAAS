-- =============================================================================
-- Niveau 2 — 2/5 : rôles, gouvernance des données locales, historique.
--
-- Répartition des droits (moindre privilège) :
--   moderator     : modère les contenus des membres et les signalements ;
--   local_editor  : crée, corrige et VÉRIFIE les données locales (lieux,
--                   quartiers, guide, sources) ; ne gère pas les comptes ;
--   admin         : comptes, organisations, référentiel, offres ; ne peut pas
--                   créer d'administrateur ;
--   superadmin    : tout, y compris l'attribution des rôles admin/superadmin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions de rôle (remplacent celles de la migration 0002)
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('moderator', 'admin', 'superadmin'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('admin', 'superadmin'), false)
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() = 'superadmin', false)
$$;

-- Peut créer, corriger et vérifier les données locales.
create or replace function public.is_curator()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('local_editor', 'admin', 'superadmin'), false)
$$;

-- Attribution des rôles : admin et superadmin réservés au superadministrateur.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if public.is_service_context() then
      return new;
    end if;
    if new.role in ('admin', 'superadmin') or old.role in ('admin', 'superadmin') then
      if not public.is_superadmin() then
        raise exception 'Seul un superadministrateur peut attribuer ou retirer un rôle d''administration.'
          using errcode = '42501';
      end if;
    elsif not public.is_admin() then
      raise exception 'Seul un administrateur peut modifier le rôle d''un compte.' using errcode = '42501';
    end if;
  end if;
  if new.is_suspended is distinct from old.is_suspended
     and not (public.is_admin() or public.is_service_context()) then
    raise exception 'Seul un administrateur peut suspendre un compte.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sources des données locales
-- -----------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  kind public.source_kind not null,
  -- Libellé public : « Relevé terrain », « Mairie de San Pedro », « Déclaration de l'exploitant »…
  title text not null check (char_length(title) between 3 and 200),
  publisher text,
  url text check (url is null or url ~* '^https?://'),
  collected_at date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sources_updated_at before update on public.sources for each row execute function public.set_updated_at();
alter table public.sources enable row level security;
create policy sources_select on public.sources for select using (true);
create policy sources_curator_write on public.sources for all to authenticated
  using ((select public.is_curator())) with check ((select public.is_curator()));

-- -----------------------------------------------------------------------------
-- Champs de vérification sur chaque contenu
-- -----------------------------------------------------------------------------
alter table public.places drop column is_verified;
alter table public.business_profiles drop column is_verified;

alter table public.places
  add column verification_status public.verification_status not null default 'pending_validation',
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column source_id uuid references public.sources (id) on delete restrict,
  add column verification_note text;

alter table public.business_profiles
  add column verification_status public.verification_status not null default 'pending_validation',
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column source_id uuid references public.sources (id) on delete restrict,
  add column verification_note text;

alter table public.events
  add column verification_status public.verification_status not null default 'pending_validation',
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column source_id uuid references public.sources (id) on delete restrict,
  add column verification_note text;

-- Pour une annonce, « à vérifier » signifie « déclaré par l'annonceur, non contrôlé ».
alter table public.listings
  add column verification_status public.verification_status not null default 'pending_validation',
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column source_id uuid references public.sources (id) on delete restrict,
  add column verification_note text;

alter table public.neighborhoods
  add column verification_status public.verification_status not null default 'pending_validation',
  add column verified_at timestamptz,
  add column verified_by uuid references public.profiles (id) on delete set null,
  add column source_id uuid references public.sources (id) on delete restrict,
  add column verification_note text;

-- « Vérifié » exige une source, une date et un responsable (docs/data-governance.md).
alter table public.places add constraint places_verified_traceable
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null));
alter table public.business_profiles add constraint business_profiles_verified_traceable
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null));
alter table public.events add constraint events_verified_traceable
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null));
alter table public.listings add constraint listings_verified_traceable
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null));
alter table public.neighborhoods add constraint neighborhoods_verified_traceable
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null));

create index places_verification_idx on public.places (verification_status);
create index business_profiles_verification_idx on public.business_profiles (verification_status);
create index events_verification_idx on public.events (verification_status);
create index listings_verification_idx on public.listings (verification_status);
create index neighborhoods_verification_idx on public.neighborhoods (verification_status);

-- -----------------------------------------------------------------------------
-- Visibilité des exemples de démonstration (paramètre d'administration)
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, description, is_public) values
  ('demo.public_placeholders', '{"enabled": true}',
   'Affiche au public les exemples de démonstration (badge « Exemple · à valider localement »). À désactiver avant le lancement public.', true)
on conflict (key) do nothing;

create or replace function public.demo_content_public()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (value ->> 'enabled')::boolean from public.platform_settings where key = 'demo.public_placeholders'), false)
$$;

-- Un contenu local est montrable au public selon son statut de vérification.
create or replace function public.verification_publicly_visible(p_status public.verification_status)
returns boolean language sql stable set search_path = '' as $$
  select p_status in ('verified', 'pending_validation') or (p_status = 'placeholder' and public.demo_content_public())
$$;

-- Droit de gérer un contenu en tant qu'auteur. Remplacée par la migration des
-- organisations pour inclure les membres habilités de l'organisation.
create or replace function public.can_manage_content(p_owner uuid, p_organization uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_owner = (select auth.uid()), false)
$$;

-- -----------------------------------------------------------------------------
-- Règles de contenu : modération (staff) ET vérification (éditeurs locaux)
-- -----------------------------------------------------------------------------
create or replace function public.enforce_content_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_column text := tg_argv[0];
  v_moderator boolean := public.is_staff() or public.is_service_context();
  v_curator boolean := public.is_curator() or public.is_service_context();
  v_new jsonb := to_jsonb(new);
  v_moderation_fields text[] := array['published_at', 'rejection_reason', 'view_count', 'expires_at'];
  v_verification_fields text[] := array['verification_status', 'verified_at', 'verified_by', 'source_id', 'verification_note'];
  v_ignored text[] := array['status', 'updated_at', 'search_vector', 'view_count', 'location_public'];
  v_patch jsonb;
  v_default_days integer;
begin
  if tg_op = 'INSERT' then
    if not v_moderator and not (v_curator and tg_table_name in ('places', 'events'))
       and new.status not in ('draft', 'pending') then
      raise exception 'Un contenu ne peut être créé qu''en brouillon ou en attente de vérification.'
        using errcode = '42501';
    end if;
    if not v_moderator then
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
      from jsonb_each('{"published_at": null, "rejection_reason": null, "view_count": 0, "expires_at": null}'::jsonb)
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);
    end if;
    if not v_curator then
      new := jsonb_populate_record(new, '{"verification_status": "pending_validation", "verified_at": null,
        "verified_by": null, "source_id": null, "verification_note": null}'::jsonb);
    end if;
  else
    if not v_moderator then
      select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key), '{}'::jsonb) into v_patch
      from unnest(v_moderation_fields || v_owner_column) as key
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);
    end if;
    if not v_curator then
      select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key), '{}'::jsonb) into v_patch
      from unnest(v_verification_fields) as key;
      new := jsonb_populate_record(new, v_patch);
    end if;

    if not v_moderator and not v_curator
       and (to_jsonb(new) - v_ignored - v_verification_fields) is distinct from (to_jsonb(old) - v_ignored - v_verification_fields) then
      -- Une modification par l'auteur renvoie une publication en modération…
      if old.status = 'published' and new.status = 'published' then
        new.status := 'pending';
      end if;
      -- … et une donnée vérifiée redevient « à vérifier ».
      if old.verification_status = 'verified' then
        new.verification_status := 'pending_validation';
      end if;
    end if;

    if new.status is distinct from old.status
       and not public.content_transition_allowed(
         old.status,
         new.status,
         v_moderator,
         public.can_manage_content((to_jsonb(old) ->> v_owner_column)::uuid, (to_jsonb(old) ->> 'organization_id')::uuid)
       )
       and not (old.status = 'published' and new.status = 'pending' and not v_moderator)
       -- Les éditeurs locaux publient et archivent les données locales qu'ils administrent.
       and not (v_curator and tg_table_name in ('places', 'events', 'neighborhoods')) then
      raise exception 'Changement de statut non autorisé (% → %).', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  -- Vérification : date et responsable renseignés automatiquement.
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, (select auth.uid()));
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if v_new ? 'published_at' then
      new := jsonb_populate_record(new, jsonb_build_object('published_at', now()));
    end if;
    if v_new ? 'expires_at'
       and coalesce((to_jsonb(new) ->> 'expires_at')::timestamptz <= now(), true) then
      select coalesce((value ->> 'days')::integer, 60) into v_default_days
      from public.platform_settings where key = 'listings.default_duration';
      new := jsonb_populate_record(
        new,
        jsonb_build_object('expires_at', now() + make_interval(days => coalesce(v_default_days, 60)))
      );
    end if;
  end if;

  if new.status = 'rejected' and coalesce(btrim(to_jsonb(new) ->> 'rejection_reason'), '') = '' then
    raise exception 'Un motif est obligatoire pour rejeter un contenu.' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Les quartiers n'avaient pas de statut de publication : ils suivent seulement la vérification.
create or replace function public.enforce_verification_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (public.is_curator() or public.is_service_context()) then
    raise exception 'Seule l''équipe locale peut modifier ce référentiel.' using errcode = '42501';
  end if;
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger neighborhoods_verification_rules before insert or update on public.neighborhoods
  for each row execute function public.enforce_verification_rules();

-- -----------------------------------------------------------------------------
-- Historique des modifications (avant / après, auteur, date, raison)
-- La raison est transmise par l'application : set_config('app.change_reason', …, true).
-- -----------------------------------------------------------------------------
create table public.content_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  action public.revision_action not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  before jsonb,
  after jsonb
);
create index content_revisions_entity_idx on public.content_revisions (entity_type, entity_id, changed_at desc);
create index content_revisions_author_idx on public.content_revisions (changed_by, changed_at desc);
alter table public.content_revisions enable row level security;
create policy content_revisions_select on public.content_revisions for select to authenticated
  using ((select public.is_staff()) or (select public.is_curator()));
revoke insert, update, delete on public.content_revisions from anon, authenticated;

create or replace function public.record_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'search_vector' end;
  v_after jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'search_vector' end;
begin
  if tg_op = 'UPDATE' and v_before - 'updated_at' = v_after - 'updated_at' then
    return new;
  end if;
  insert into public.content_revisions (entity_type, entity_id, action, changed_by, reason, before, after)
  values (
    tg_table_name,
    coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid),
    lower(tg_op)::public.revision_action,
    (select auth.uid()),
    nullif(current_setting('app.change_reason', true), ''),
    v_before,
    v_after
  );
  return coalesce(new, old);
end;
$$;

create trigger places_revisions after insert or update or delete on public.places for each row execute function public.record_revision();
create trigger listings_revisions after insert or update or delete on public.listings for each row execute function public.record_revision();
create trigger events_revisions after insert or update or delete on public.events for each row execute function public.record_revision();
create trigger business_profiles_revisions after insert or update or delete on public.business_profiles for each row execute function public.record_revision();
create trigger neighborhoods_revisions after insert or update or delete on public.neighborhoods for each row execute function public.record_revision();
create trigger categories_revisions after insert or update or delete on public.categories for each row execute function public.record_revision();
create trigger cities_revisions after insert or update or delete on public.cities for each row execute function public.record_revision();
create trigger sources_revisions after insert or update or delete on public.sources for each row execute function public.record_revision();
create trigger plans_revisions after insert or update or delete on public.plans for each row execute function public.record_revision();

-- -----------------------------------------------------------------------------
-- Règles d'accès mises à jour
-- -----------------------------------------------------------------------------
drop policy listings_select on public.listings;
create policy listings_select on public.listings for select using (
  (status = 'published' and (expires_at is null or expires_at > now())
    and public.verification_publicly_visible(verification_status))
  or owner_id = (select auth.uid())
  or (select public.is_staff())
);

drop policy places_select on public.places;
create policy places_select on public.places for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or created_by = (select auth.uid())
  or (select public.is_staff())
  or (select public.is_curator())
);

drop policy places_insert on public.places;
create policy places_insert on public.places for insert to authenticated with check (
  created_by = (select auth.uid())
  and not (select public.is_suspended())
  and (kind = 'etablissement' or (select public.is_curator()) or (select public.is_staff()))
);

drop policy places_update on public.places;
create policy places_update on public.places for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_staff()) or (select public.is_curator()))
  with check (created_by = (select auth.uid()) or (select public.is_staff()) or (select public.is_curator()));

drop policy events_select on public.events;
create policy events_select on public.events for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or organizer_id = (select auth.uid())
  or (select public.is_staff())
  or (select public.is_curator())
);

drop policy events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (organizer_id = (select auth.uid()) or (select public.is_staff()) or (select public.is_curator()))
  with check (organizer_id = (select auth.uid()) or (select public.is_staff()) or (select public.is_curator()));

drop policy business_profiles_select on public.business_profiles;
create policy business_profiles_select on public.business_profiles for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or owner_id = (select auth.uid())
  or (select public.is_staff())
  or (select public.is_curator())
);

drop policy neighborhoods_select on public.neighborhoods;
create policy neighborhoods_select on public.neighborhoods for select using (
  (is_active and public.verification_publicly_visible(verification_status))
  or (select public.is_staff())
  or (select public.is_curator())
);

drop policy neighborhoods_admin_write on public.neighborhoods;
create policy neighborhoods_curator_write on public.neighborhoods for all to authenticated
  using ((select public.is_curator())) with check ((select public.is_curator()));
