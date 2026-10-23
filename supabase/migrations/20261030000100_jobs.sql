-- =============================================================================
-- Niveau 17 : emploi et opportunités.
-- - Offres, stages, missions, demandes (compétences), formations, appels à
--   prestataires et opportunités = annonces (`listings`) de ces catégories,
--   modérées comme toute annonce.
-- - Une position précise n'est exigée que pour les annonces de biens : une offre
--   d'emploi n'en a pas besoin (rien n'est inventé pour remplir la case).
-- - Date limite : l'annonce expire au plus tard le lendemain ; candidature
--   impossible après la date limite, l'expiration ou la clôture.
-- - Profils candidats privés par défaut, coordonnées jamais lisibles directement.
-- - Candidatures : l'employeur change le statut (décision humaine), jamais le
--   contenu ; candidat et employeur sont notifiés.
-- =============================================================================

insert into public.categories (parent_id, family, slug, name, content_types, attribute_schema, sort_order, keywords)
select parent.id, parent.family, 'missions-freelance', 'Missions et freelance', '{listing}'::public.content_type[], 'emploi', 25,
       '{mission,freelance,independant,consultant,prestation ponctuelle}'::text[]
from public.categories parent where parent.slug = 'emploi-stages'
on conflict (slug) do nothing;

update public.categories c set keywords = v.keywords::text[]
from (values
  ('offres-emploi', '{emploi,recrutement,poste,cdi,cdd,job,embauche}'),
  ('stages', '{stage,stagiaire,alternance,apprentissage}'),
  ('demandes-emploi', '{cherche emploi,competences,cv,disponible,candidat}'),
  ('appels-offres', '{appel d offres,consultation,prestataire,marche}'),
  ('opportunites-commerciales', '{partenariat,fournisseur,distributeur,opportunite}')
) as v(slug, keywords)
where c.slug = v.slug and c.keywords = '{}';

-- Schéma d'attributs d'une annonce (emploi, opportunite, appel_offres, bien…).
create or replace function public.listing_schema(p_category uuid)
returns text language sql stable security definer set search_path = '' as $$
  select attribute_schema from public.categories where id = p_category
$$;

-- -----------------------------------------------------------------------------
-- Position précise : exigée seulement pour les annonces qui en ont besoin
-- -----------------------------------------------------------------------------
alter table public.listings drop constraint listings_location_required;

create or replace function public.require_listing_location()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'draft' and new.location is null
     and coalesce(public.listing_schema(new.category_id), '') not in ('emploi', 'opportunite', 'appel_offres', 'formation') then
    raise exception 'La position de l''annonce est requise pour la soumettre.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger listings_require_location before insert or update of status, location, category_id on public.listings
  for each row execute function public.require_listing_location();

-- -----------------------------------------------------------------------------
-- Date limite : expiration au plus tard le lendemain (après les règles de contenu)
-- -----------------------------------------------------------------------------
create or replace function public.safe_date(p_value text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or p_value !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

create or replace function public.apply_listing_deadline()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_deadline date := public.safe_date(new.attributes ->> 'date_limite');
  v_end timestamptz;
begin
  if v_deadline is null or coalesce(public.listing_schema(new.category_id), '') not in ('emploi', 'opportunite', 'appel_offres') then
    return new;
  end if;
  -- San Pedro est à l'heure UTC : fin de la journée limite = minuit UTC le lendemain.
  v_end := (v_deadline + 1)::timestamp at time zone 'UTC';
  if new.status in ('pending', 'published') and v_end <= now() then
    raise exception 'La date limite est déjà passée.' using errcode = '23514';
  end if;
  if new.status = 'published' then
    new.expires_at := least(coalesce(new.expires_at, v_end), v_end);
  end if;
  return new;
end;
$$;
-- Nom choisi pour s'exécuter après listings_content_rules (ordre alphabétique des déclencheurs).
create trigger listings_zz_deadline before insert or update on public.listings
  for each row execute function public.apply_listing_deadline();

-- Candidature : aussi refusée après la date limite.
create or replace function public.validate_job_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ok boolean;
begin
  if tg_op = 'INSERT' then
    select l.status = 'published'
           and (l.expires_at is null or l.expires_at > now())
           and coalesce(l.availability_status, 'unknown') <> 'unavailable'
           and coalesce(k.attribute_schema, '') = 'emploi'
           and coalesce(l.attributes ->> 'candidature', 'interne') = 'interne'
           and coalesce(public.safe_date(l.attributes ->> 'date_limite'), 'infinity'::date) >= (now() at time zone 'UTC')::date
           and l.owner_id <> new.applicant_id
      into v_ok
    from public.listings l join public.categories k on k.id = l.category_id
    where l.id = new.listing_id;
    if not coalesce(v_ok, false) then
      raise exception 'Cette offre n''accepte pas de candidature (close, expirée ou candidature sur un site externe).' using errcode = '23514';
    end if;
    new.status := 'submitted';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Candidatures : statut seulement, décisions humaines, notifications
-- -----------------------------------------------------------------------------
create or replace function public.protect_job_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_listing public.listings;
  v_employer boolean;
begin
  if public.is_service_request() then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
    raise exception 'Une candidature ne se modifie pas : seul son statut change.' using errcode = '42501';
  end if;
  select * into v_listing from public.listings where id = new.listing_id;
  v_employer := public.can_manage_content(v_listing.owner_id, v_listing.organization_id);
  if new.status is distinct from old.status then
    if old.status = 'withdrawn' then
      raise exception 'Candidature retirée par son auteur.' using errcode = '23514';
    end if;
    if new.applicant_id = (select auth.uid()) and not v_employer and new.status <> 'withdrawn' then
      raise exception 'Vous pouvez seulement retirer votre candidature.' using errcode = '42501';
    end if;
    if new.status in ('shortlisted', 'rejected') then
      insert into public.notifications (user_id, type, title, link)
      values (new.applicant_id, 'candidature',
              case when new.status = 'shortlisted' then 'Candidature retenue pour la suite : ' else 'Candidature non retenue : ' end || v_listing.title,
              '/emploi/mes-candidatures');
    end if;
  end if;
  return new;
end;
$$;
create trigger job_applications_protect before update on public.job_applications
  for each row execute function public.protect_job_application();

create or replace function public.notify_job_application()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, type, title, link)
  select l.owner_id, 'candidature', 'Nouvelle candidature : ' || l.title, '/emploi/candidatures'
  from public.listings l where l.id = new.listing_id;
  return new;
end;
$$;
create trigger job_applications_notify after insert on public.job_applications
  for each row execute function public.notify_job_application();

-- Candidature avec le nom affiché du candidat, pour l'employeur (règles d'accès de la table).
create or replace function public.received_applications()
returns table (id uuid, listing_id uuid, listing_title text, listing_slug text, applicant_id uuid, applicant_name text,
               message text, status public.application_status, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, l.id, l.title, l.slug, a.applicant_id, coalesce(p.display_name, 'Candidat'), a.message, a.status, a.created_at
  from public.job_applications a
  join public.listings l on l.id = a.listing_id
  left join public.profiles p on p.id = a.applicant_id
  where public.can_manage_content(l.owner_id, l.organization_id)
  order by a.created_at desc
  limit 300
$$;
revoke execute on function public.received_applications() from public, anon;
grant execute on function public.received_applications() to authenticated;

-- -----------------------------------------------------------------------------
-- Profils candidats : privés par défaut, coordonnées jamais lisibles directement
-- -----------------------------------------------------------------------------
create table public.candidate_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text not null check (char_length(headline) between 5 and 120),
  summary text check (summary is null or char_length(summary) <= 2000),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  domains text[] not null default '{}' check (cardinality(domains) <= 5),
  experience text check (experience in ('debutant', 'un_trois', 'trois_cinq', 'cinq_plus')),
  available boolean not null default true,
  neighborhood_id uuid references public.neighborhoods (id) on delete set null,
  -- private : personne ; employers : comptes employeurs connectés ; public : tout le monde.
  visibility text not null default 'private' check (visibility in ('private', 'employers', 'public')),
  share_contact boolean not null default false,
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  updated_at timestamptz not null default now()
);
create trigger candidate_profiles_updated_at before update on public.candidate_profiles for each row execute function public.set_updated_at();
alter table public.candidate_profiles enable row level security;

-- Employeur : compte professionnel, membre d'une organisation, ou équipe.
create or replace function public.is_employer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_user_role() in ('professional', 'moderator', 'admin', 'superadmin'), false)
      or exists (select 1 from public.organization_members m where m.user_id = (select auth.uid()))
$$;

create policy candidate_profiles_owner on public.candidate_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and not (select public.is_suspended()));
create policy candidate_profiles_visible on public.candidate_profiles for select using (
  visibility = 'public' or (visibility = 'employers' and (select public.is_employer())) or (select public.is_staff())
);
-- Les coordonnées ne sont lisibles que par le candidat (et par la fonction ci-dessous).
select public.grant_public_columns('candidate_profiles', array['contact_email', 'contact_phone']);

create or replace function public.my_candidate_contact()
returns table (contact_email text, contact_phone text)
language sql stable security definer set search_path = '' as $$
  select contact_email, contact_phone from public.candidate_profiles where user_id = (select auth.uid())
$$;

-- Coordonnées d'un candidat : seulement s'il les partage, à un employeur connecté, profil visible.
create or replace function public.reveal_candidate_contact(p_user uuid)
returns table (contact_email text, contact_phone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_employer() then
    raise exception 'Réservé aux comptes employeurs.' using errcode = '42501';
  end if;
  return query
  select c.contact_email, c.contact_phone from public.candidate_profiles c
  where c.user_id = p_user and c.share_contact and c.visibility in ('employers', 'public');
end;
$$;
revoke execute on function public.my_candidate_contact() from public, anon;
revoke execute on function public.reveal_candidate_contact(uuid) from public, anon;
revoke execute on function public.is_employer() from public;
grant execute on function public.my_candidate_contact() to authenticated;
grant execute on function public.reveal_candidate_contact(uuid) to authenticated;
grant execute on function public.is_employer() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Recherche d'offres et opportunités (droits de l'appelant)
-- -----------------------------------------------------------------------------
create or replace function public.search_jobs(
  p_city uuid,
  p_categories uuid[],
  p_query text default null,
  p_contract text default null,
  p_domain text default null,
  p_experience text default null,
  p_since_days integer default null,
  p_neighborhood uuid default null,
  p_remote text default null,
  p_organization text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (id uuid, total_count bigint)
language sql stable security invoker set search_path = '' as $$
  select l.id, count(*) over ()
  from public.listings l
  where l.city_id = p_city
    and l.status = 'published'
    and (l.expires_at is null or l.expires_at > now())
    and l.availability_status <> 'unavailable'
    and l.category_id = any (p_categories)
    and (public.search_normalize(p_query) = '' or l.search_vector @@ public.search_tsquery(p_query)
         or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(l.title))
    and (p_contract is null or l.attributes ->> 'contrat' = p_contract)
    and (p_domain is null or l.attributes ->> 'domaine' = p_domain)
    and (p_experience is null or l.attributes ->> 'experience' = p_experience)
    and (p_since_days is null or l.published_at >= now() - make_interval(days => p_since_days))
    and (p_neighborhood is null or l.neighborhood_id = p_neighborhood)
    and (p_remote is null or l.attributes ->> 'teletravail' = p_remote)
    and (p_organization is null or l.attributes ->> 'organisation' = p_organization)
  order by l.published_at desc nulls last, l.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.search_jobs(uuid, uuid[], text, text, text, text, integer, uuid, text, text, integer, integer) from public;
grant execute on function public.search_jobs(uuid, uuid[], text, text, text, text, integer, uuid, text, text, integer, integer) to anon, authenticated;
