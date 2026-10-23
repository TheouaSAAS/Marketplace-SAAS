-- =============================================================================
-- Niveau 21 : espace professionnel (statistiques agrégées, boîte de réception de
-- l'équipe, historique de modération, annonces de la page)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vues des pages professionnelles : même principe que les annonces (un
-- visiteur distinct par jour, empreinte sans donnée personnelle, purgée).
-- -----------------------------------------------------------------------------
create table public.business_view_counts (
  business_id uuid primary key references public.business_profiles (id) on delete cascade,
  views integer not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);
create table public.business_view_marks (
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  viewer_hash text not null check (char_length(viewer_hash) = 64),
  day date not null default current_date,
  primary key (business_id, viewer_hash, day)
);
alter table public.business_view_counts enable row level security;
alter table public.business_view_marks enable row level security;
create policy business_view_counts_none on public.business_view_counts for select using (false);
create policy business_view_marks_none on public.business_view_marks for select using (false);

create or replace function public.record_business_view(p_business uuid, p_viewer_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.business_profiles where id = p_business and status = 'published') then
    return false;
  end if;
  insert into public.business_view_marks (business_id, viewer_hash) values (p_business, p_viewer_hash) on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.business_view_counts as c (business_id, views) values (p_business, 1)
  on conflict (business_id) do update set views = c.views + 1, updated_at = now();
  return true;
end;
$$;
revoke execute on function public.record_business_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_business_view(uuid, text) to service_role;

-- Les empreintes de vues ne servent qu'à dédoublonner le jour même.
select cron.schedule('purger-vues-pages-pro', '22 3 * * *', $$delete from public.business_view_marks where day < current_date - 1$$);

-- -----------------------------------------------------------------------------
-- Droits sur une page : membre (lecture de l'espace) ou gestionnaire (éditeur+)
-- -----------------------------------------------------------------------------
create or replace function public.is_page_member(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_profiles b
    where b.id = p_business
      and (b.owner_id = (select auth.uid()) or (b.organization_id is not null and public.is_org_member(b.organization_id)))
  )
$$;
create or replace function public.is_page_manager(p_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.business_profiles b where b.id = p_business and public.can_manage_content(b.owner_id, b.organization_id))
$$;
revoke execute on function public.is_page_member(uuid) from public, anon;
revoke execute on function public.is_page_manager(uuid) from public, anon;
grant execute on function public.is_page_member(uuid) to authenticated;
grant execute on function public.is_page_manager(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Boîte de réception : les demandes adressées à une page sont lues et traitées
-- par ses gestionnaires (éditeurs et plus), jamais par une autre équipe.
-- -----------------------------------------------------------------------------
create policy contact_requests_page_select on public.contact_requests for select to authenticated
  using (business_id is not null and public.is_page_manager(business_id));
create policy contact_requests_page_update on public.contact_requests for update to authenticated
  using (business_id is not null and public.is_page_manager(business_id))
  with check (business_id is not null and public.is_page_manager(business_id));

-- Seul le statut d'une demande change (lue, répondue, archivée) : le contenu envoyé reste intact.
create or replace function public.protect_contact_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_staff() or public.is_service_context() then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Seul le statut d''une demande se modifie.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger contact_requests_protect before update on public.contact_requests
  for each row execute function public.protect_contact_request();

-- -----------------------------------------------------------------------------
-- Rattacher une annonce à une page exige de gérer cette page.
-- -----------------------------------------------------------------------------
create or replace function public.validate_listing_business()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.business_id is not null
     and (tg_op = 'INSERT' or new.business_id is distinct from old.business_id)
     and not (public.is_page_manager(new.business_id) or public.is_staff() or public.is_service_context()) then
    raise exception 'Vous n''êtes pas habilité à publier pour cette page professionnelle.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger listings_business_check before insert or update of business_id on public.listings
  for each row execute function public.validate_listing_business();

-- -----------------------------------------------------------------------------
-- Annonces, offres et événements d'une page (tous statuts), pour ses membres.
-- -----------------------------------------------------------------------------
create or replace function public.pro_listings(p_business uuid)
returns table (
  id uuid, slug text, title text, status public.content_status, availability_status public.availability_status,
  rejection_reason text, expires_at timestamptz, updated_at timestamptz, category_name text, schema text,
  views integer, favorites bigint, contact_reveals bigint, conversations bigint
)
language sql stable security definer set search_path = '' as $$
  select l.id, l.slug, l.title, l.status, l.availability_status, l.rejection_reason, l.expires_at, l.updated_at, c.name, c.attribute_schema,
         coalesce((select v.views from public.listing_view_counts v where v.listing_id = l.id), 0),
         (select count(*) from public.favorites f where f.listing_id = l.id),
         (select count(*) from public.contact_reveals r where r.listing_id = l.id),
         (select count(*) from public.conversations x where x.listing_id = l.id)
  from public.business_profiles b
  join public.listings l on l.business_id = b.id or (b.organization_id is not null and l.organization_id = b.organization_id)
  join public.categories c on c.id = l.category_id
  where b.id = p_business and public.is_page_member(p_business)
  order by l.updated_at desc
  limit 200
$$;
revoke execute on function public.pro_listings(uuid) from public, anon;
grant execute on function public.pro_listings(uuid) to authenticated;

create or replace function public.pro_events(p_business uuid)
returns table (id uuid, slug text, title text, status public.content_status, starts_at timestamptz, rejection_reason text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.slug, e.title, e.status, e.starts_at, e.rejection_reason
  from public.business_profiles b
  join public.events e on b.organization_id is not null and e.organization_id = b.organization_id
  where b.id = p_business and public.is_page_member(p_business)
  order by e.starts_at desc
  limit 100
$$;
revoke execute on function public.pro_events(uuid) from public, anon;
grant execute on function public.pro_events(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Statistiques d'une page : AGRÉGATS seulement, aucune donnée de visiteur.
-- -----------------------------------------------------------------------------
create or replace function public.pro_stats(p_business uuid)
returns table (
  page_views integer, page_favorites bigint, requests_total bigint, requests_30d bigint, requests_unanswered bigint,
  conversations bigint, reviews_published bigint, rating_average numeric,
  listings_published bigint, listing_views bigint, listing_favorites bigint, listing_contact_reveals bigint
)
language sql stable security definer set search_path = '' as $$
  with page as (select b.* from public.business_profiles b where b.id = p_business and public.is_page_member(p_business)),
  owned as (
    select l.id, l.status from public.listings l, page
    where l.business_id = page.id or (page.organization_id is not null and l.organization_id = page.organization_id)
  )
  select
    coalesce((select views from public.business_view_counts where business_id = page.id), 0),
    (select count(*) from public.favorites f where f.business_id = page.id),
    (select count(*) from public.contact_requests r where r.business_id = page.id),
    (select count(*) from public.contact_requests r where r.business_id = page.id and r.created_at > now() - interval '30 days'),
    (select count(*) from public.contact_requests r where r.business_id = page.id and r.status in ('new', 'read')),
    (select count(*) from public.conversations c where c.business_id = page.id),
    (select count(*) from public.reviews v where v.business_id = page.id and v.status = 'published'),
    (select round(avg(v.rating)::numeric, 1) from public.reviews v where v.business_id = page.id and v.status = 'published'),
    (select count(*) from owned where status = 'published'),
    (select coalesce(sum(v.views), 0) from public.listing_view_counts v join owned on owned.id = v.listing_id),
    (select count(*) from public.favorites f join owned on owned.id = f.listing_id),
    (select count(*) from public.contact_reveals r join owned on owned.id = r.listing_id)
  from page
$$;
revoke execute on function public.pro_stats(uuid) from public, anon;
grant execute on function public.pro_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Historique de modération de la page et de ses annonces, avec les motifs.
-- -----------------------------------------------------------------------------
create or replace function public.pro_moderation_history(p_business uuid)
returns table (changed_at timestamptz, entity text, title text, status_before text, status_after text, reason text)
language sql stable security definer set search_path = '' as $$
  select r.changed_at,
         case r.entity_type when 'business_profiles' then 'page' else 'annonce' end,
         coalesce(r.after ->> 'name', r.after ->> 'title', r.before ->> 'name', r.before ->> 'title'),
         r.before ->> 'status', r.after ->> 'status',
         case when r.after ->> 'status' = 'rejected' then r.after ->> 'rejection_reason' end
  from public.content_revisions r
  where public.is_page_member(p_business)
    and (
      (r.entity_type = 'business_profiles' and r.entity_id = p_business)
      or (r.entity_type = 'listings' and r.entity_id in (
        select l.id from public.listings l join public.business_profiles b on b.id = p_business
        where l.business_id = b.id or (b.organization_id is not null and l.organization_id = b.organization_id)))
    )
    and (r.before ->> 'status') is distinct from (r.after ->> 'status')
  order by r.changed_at desc
  limit 60
$$;
revoke execute on function public.pro_moderation_history(uuid) from public, anon;
grant execute on function public.pro_moderation_history(uuid) to authenticated;
