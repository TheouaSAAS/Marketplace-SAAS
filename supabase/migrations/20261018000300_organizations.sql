-- =============================================================================
-- Niveau 2 — 3/5 : organisations et membres.
-- Une organisation (entreprise, commerce, agence, association…) regroupe des
-- membres avec un rôle interne. Ses contenus (vitrine, annonces, lieux,
-- événements) sont gérables par ses membres habilités, et par eux seuls.
-- =============================================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  kind public.organization_kind not null default 'entreprise',
  city_id uuid not null references public.cities (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null default 'editor',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
create trigger organization_members_updated_at before update on public.organization_members for each row execute function public.set_updated_at();

-- Rang d'un rôle interne : owner 4 > admin 3 > editor 2 > viewer 1.
create or replace function public.organization_role_rank(p_role public.organization_role)
returns integer language sql immutable set search_path = '' as $$
  select case p_role when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 else 1 end
$$;

create or replace function public.is_org_member(p_organization uuid, p_min_role public.organization_role default 'viewer')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization
      and m.user_id = (select auth.uid())
      and not o.is_suspended
      and public.organization_role_rank(m.role) >= public.organization_role_rank(p_min_role)
  )
$$;

-- Version complète : auteur OU membre « editor » ou plus de l'organisation.
create or replace function public.can_manage_content(p_owner uuid, p_organization uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_owner = (select auth.uid()), false)
      or (p_organization is not null and public.is_org_member(p_organization, 'editor'))
$$;

-- Le créateur devient propriétaire de l'organisation.
create or replace function public.add_organization_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger organizations_add_owner after insert on public.organizations
  for each row execute function public.add_organization_owner();

-- Gestion des membres : seul un propriétaire attribue ou retire le rôle owner ;
-- une organisation garde toujours au moins un propriétaire.
create or replace function public.protect_organization_members()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_privileged boolean := public.is_admin() or public.is_service_context();
begin
  if tg_op = 'INSERT' and new.role = 'owner' and new.user_id <> (select o.created_by from public.organizations o where o.id = new.organization_id)
     and not (v_privileged or public.is_org_member(v_org, 'owner')) then
    raise exception 'Seul un propriétaire peut désigner un autre propriétaire.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and (new.role = 'owner' or old.role = 'owner') and new.role is distinct from old.role
     and not (v_privileged or public.is_org_member(v_org, 'owner')) then
    raise exception 'Seul un propriétaire peut modifier le rôle de propriétaire.' using errcode = '42501';
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.organization_members m
       where m.organization_id = old.organization_id and m.role = 'owner' and m.id <> old.id
     ) then
    -- Suppression en cascade de l'organisation : autorisée.
    if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then
      return old;
    end if;
    raise exception 'Une organisation doit garder au moins un propriétaire.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger organization_members_protect before insert or update or delete on public.organization_members
  for each row execute function public.protect_organization_members();

create trigger organizations_revisions after insert or update or delete on public.organizations for each row execute function public.record_revision();
create trigger organization_members_revisions after insert or update or delete on public.organization_members for each row execute function public.record_revision();

-- -----------------------------------------------------------------------------
-- Rattachement des contenus
-- -----------------------------------------------------------------------------
alter table public.business_profiles add column organization_id uuid references public.organizations (id) on delete set null;
alter table public.listings add column organization_id uuid references public.organizations (id) on delete set null;
alter table public.places add column organization_id uuid references public.organizations (id) on delete set null;
alter table public.events add column organization_id uuid references public.organizations (id) on delete set null;
alter table public.subscriptions add column organization_id uuid references public.organizations (id) on delete set null;
alter table public.sponsored_campaigns add column organization_id uuid references public.organizations (id) on delete set null;

create index business_profiles_organization_idx on public.business_profiles (organization_id) where organization_id is not null;
create index listings_organization_idx on public.listings (organization_id) where organization_id is not null;
create index places_organization_idx on public.places (organization_id) where organization_id is not null;
create index events_organization_idx on public.events (organization_id) where organization_id is not null;

-- Rattacher un contenu à une organisation exige d'en être membre habilité.
create or replace function public.validate_organization_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.organization_id is not null
     and (tg_op = 'INSERT' or new.organization_id is distinct from old.organization_id)
     and not (public.is_org_member(new.organization_id, 'editor') or public.is_staff() or public.is_service_context()) then
    raise exception 'Vous n''êtes pas habilité à publier au nom de cette organisation.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger business_profiles_org_check before insert or update of organization_id on public.business_profiles
  for each row execute function public.validate_organization_assignment();
create trigger listings_org_check before insert or update of organization_id on public.listings
  for each row execute function public.validate_organization_assignment();
create trigger places_org_check before insert or update of organization_id on public.places
  for each row execute function public.validate_organization_assignment();
create trigger events_org_check before insert or update of organization_id on public.events
  for each row execute function public.validate_organization_assignment();

-- -----------------------------------------------------------------------------
-- Règles d'accès
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Les informations publiques d'une organisation passent par sa vitrine (business_profiles).
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or (select public.is_staff()));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = (select auth.uid()) and not (select public.is_suspended()));
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_member(id, 'admin') or (select public.is_admin()))
  with check (public.is_org_member(id, 'admin') or (select public.is_admin()));
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.is_org_member(id, 'owner') or (select public.is_admin()));

create policy organization_members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id) or (select public.is_staff()));
create policy organization_members_write on public.organization_members for all to authenticated
  using (public.is_org_member(organization_id, 'admin') or (select public.is_admin()))
  with check (public.is_org_member(organization_id, 'admin') or (select public.is_admin()));
-- Un membre peut quitter l'organisation.
create policy organization_members_leave on public.organization_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- Le statut de suspension d'une organisation est réservé aux administrateurs de la plateforme.
create or replace function public.protect_organization_suspension()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_suspended is distinct from old.is_suspended and not (public.is_admin() or public.is_service_context()) then
    raise exception 'Seul un administrateur peut suspendre une organisation.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger organizations_protect_suspension before update on public.organizations
  for each row execute function public.protect_organization_suspension();

-- Contenus : les membres habilités de l'organisation ont les mêmes droits que l'auteur.
drop policy listings_select on public.listings;
create policy listings_select on public.listings for select using (
  (status = 'published' and (expires_at is null or expires_at > now())
    and public.verification_publicly_visible(verification_status))
  or public.can_manage_content(owner_id, organization_id)
  or (select public.is_staff())
);
drop policy listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated
  using (public.can_manage_content(owner_id, organization_id) or (select public.is_staff()))
  with check (public.can_manage_content(owner_id, organization_id) or (select public.is_staff()));
drop policy listings_delete on public.listings;
create policy listings_delete on public.listings for delete to authenticated
  using ((public.can_manage_content(owner_id, organization_id) and status = 'draft') or (select public.is_admin()));

drop policy places_select on public.places;
create policy places_select on public.places for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or public.can_manage_content(created_by, organization_id)
  or (select public.is_staff())
  or (select public.is_curator())
);
drop policy places_update on public.places;
create policy places_update on public.places for update to authenticated
  using (public.can_manage_content(created_by, organization_id) or (select public.is_staff()) or (select public.is_curator()))
  with check (public.can_manage_content(created_by, organization_id) or (select public.is_staff()) or (select public.is_curator()));

drop policy events_select on public.events;
create policy events_select on public.events for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or public.can_manage_content(organizer_id, organization_id)
  or (select public.is_staff())
  or (select public.is_curator())
);
drop policy events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.can_manage_content(organizer_id, organization_id) or (select public.is_staff()) or (select public.is_curator()))
  with check (public.can_manage_content(organizer_id, organization_id) or (select public.is_staff()) or (select public.is_curator()));

drop policy business_profiles_select on public.business_profiles;
create policy business_profiles_select on public.business_profiles for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or public.can_manage_content(owner_id, organization_id)
  or (select public.is_staff())
  or (select public.is_curator())
);
drop policy business_profiles_update on public.business_profiles;
create policy business_profiles_update on public.business_profiles for update to authenticated
  using (public.can_manage_content(owner_id, organization_id) or (select public.is_staff()))
  with check (public.can_manage_content(owner_id, organization_id) or (select public.is_staff()));

-- Abonnements et campagnes visibles des administrateurs de l'organisation.
drop policy subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select to authenticated using (
  user_id = (select auth.uid())
  or (organization_id is not null and public.is_org_member(organization_id, 'admin'))
  or (select public.is_admin())
);
