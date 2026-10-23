-- =============================================================================
-- Niveau 20 : tableau de bord — confidentialité appliquée au site public,
-- notifications par catégorie, statistiques et historique de mes annonces.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Préférences de confidentialité (toutes activées par défaut, comme avant)
-- -----------------------------------------------------------------------------
alter table public.user_preferences
  add column show_public_name boolean not null default true,
  add column show_member_since boolean not null default true,
  add column show_listing_count boolean not null default true,
  add column search_indexing boolean not null default true;

-- Préférence d'un membre (lecture interne aux fonctions publiques ci-dessous).
create or replace function public.member_privacy(p_user uuid)
returns table (show_public_name boolean, show_member_since boolean, show_listing_count boolean, search_indexing boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(u.show_public_name, true), coalesce(u.show_member_since, true), coalesce(u.show_listing_count, true), coalesce(u.search_indexing, true)
  from (select p_user as id) x left join public.user_preferences u on u.user_id = x.id
$$;
revoke execute on function public.member_privacy(uuid) from public, anon, authenticated;

-- Indexation par les moteurs de recherche des annonces d'un membre (seule info publique).
create or replace function public.member_allows_indexing(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select search_indexing from public.user_preferences where user_id = p_user), true)
$$;
grant execute on function public.member_allows_indexing(uuid) to anon, authenticated;

-- Vendeur d'une annonce : nom, ancienneté et nombre d'annonces selon ses choix.
create or replace function public.listing_seller(p_listing uuid)
returns table (
  display_name text,
  avatar_url text,
  member_since timestamptz,
  is_professional boolean,
  organization_name text,
  active_listings bigint
)
language sql stable security definer set search_path = '' as $$
  select
    case when pref.show_public_name then coalesce(p.display_name, 'Membre') else 'Membre' end,
    case when pref.show_public_name then p.avatar_url end,
    case when pref.show_member_since then p.created_at end,
    p.role = 'professional' or l.organization_id is not null,
    o.name,
    case when pref.show_listing_count then
      (select count(*) from public.listings x
        where x.owner_id = l.owner_id and x.status = 'published'
          and (x.expires_at is null or x.expires_at > now())
          and public.verification_publicly_visible(x.verification_status))
    end
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  cross join lateral public.member_privacy(l.owner_id) pref
  left join public.organizations o on o.id = l.organization_id
  where l.id = p_listing and (public.listing_is_public(l.id) or public.listing_is_manageable(l.id))
$$;

-- Commentaires publics : nom affiché seulement si l'auteur l'accepte.
create or replace function public.listing_comment_thread(p_listing uuid)
returns table (
  id uuid,
  parent_id uuid,
  body text,
  created_at timestamptz,
  author_name text,
  is_seller boolean,
  is_mine boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.parent_id, c.body, c.created_at,
         case when pref.show_public_name then coalesce(p.display_name, 'Membre') else 'Membre' end,
         c.author_id = l.owner_id or exists (
           select 1 from public.organization_members m
           where m.organization_id = l.organization_id and m.user_id = c.author_id and m.role in ('owner', 'admin', 'editor')
         ),
         coalesce(c.author_id = (select auth.uid()), false)
  from public.listing_comments c
  join public.listings l on l.id = c.listing_id
  join public.profiles p on p.id = c.author_id
  cross join lateral public.member_privacy(c.author_id) pref
  where c.listing_id = p_listing
    and c.status = 'visible'
    and (public.listing_is_public(l.id) or public.listing_is_manageable(l.id))
  order by coalesce(c.parent_id, c.id), c.parent_id nulls first, c.created_at
$$;

-- Avis publics : même règle pour le nom de l'auteur.
create or replace function public.business_reviews(p_business uuid, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, rating smallint, body text, created_at timestamptz, author_name text, response_body text, response_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.body, r.created_at,
         case when pref.show_public_name then coalesce(p.display_name, 'Membre') else 'Membre' end,
         r.response_body, r.response_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  cross join lateral public.member_privacy(r.author_id) pref
  join public.business_profiles b on b.id = r.business_id and b.status = 'published'
  where r.business_id = p_business and r.status = 'published'
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;

-- -----------------------------------------------------------------------------
-- Notifications : catégories que la personne peut couper (les décisions de
-- modération, revendications et vérifications restent toujours envoyées).
-- Préférence : user_preferences.notification_channels -> {"avis": {"site": false}}
-- -----------------------------------------------------------------------------
create or replace function public.filter_muted_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('avis', 'candidature', 'equipe', 'evenement', 'rappel')
     and exists (
       select 1 from public.user_preferences u
       where u.user_id = new.user_id and (u.notification_channels -> new.type ->> 'site') = 'false'
     ) then
    return null;
  end if;
  return new;
end;
$$;
create trigger notifications_filter_muted before insert on public.notifications
  for each row execute function public.filter_muted_notification();

-- -----------------------------------------------------------------------------
-- Mes annonces : statistiques et historique des statuts (auteur seulement)
-- -----------------------------------------------------------------------------
create or replace function public.my_listing_stats()
returns table (listing_id uuid, views integer, favorites bigint, contact_reveals bigint, conversations bigint)
language sql stable security definer set search_path = '' as $$
  select l.id,
         coalesce((select v.views from public.listing_view_counts v where v.listing_id = l.id), 0),
         (select count(*) from public.favorites f where f.listing_id = l.id),
         (select count(*) from public.contact_reveals r where r.listing_id = l.id),
         (select count(*) from public.conversations c where c.listing_id = l.id)
  from public.listings l
  where l.owner_id = (select auth.uid())
$$;
revoke execute on function public.my_listing_stats() from public, anon;
grant execute on function public.my_listing_stats() to authenticated;

create or replace function public.my_listing_history(p_listing uuid)
returns table (changed_at timestamptz, action public.revision_action, status_before text, status_after text, availability_before text, availability_after text)
language sql stable security definer set search_path = '' as $$
  select r.changed_at, r.action, r.before ->> 'status', r.after ->> 'status', r.before ->> 'availability_status', r.after ->> 'availability_status'
  from public.content_revisions r
  where r.entity_type = 'listings' and r.entity_id = p_listing
    and exists (select 1 from public.listings l where l.id = p_listing and l.owner_id = (select auth.uid()))
    and (r.action = 'insert'
      or (r.before ->> 'status') is distinct from (r.after ->> 'status')
      or (r.before ->> 'availability_status') is distinct from (r.after ->> 'availability_status'))
  order by r.changed_at desc
  limit 30
$$;
revoke execute on function public.my_listing_history(uuid) from public, anon;
grant execute on function public.my_listing_history(uuid) to authenticated;
