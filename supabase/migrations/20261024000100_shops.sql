-- =============================================================================
-- Niveau 11 : commerces et annuaire local.
-- - Vitrine = lieu de type « établissement » (fiche tenue par l'équipe locale),
--   dans une catégorie de commerce administrable.
-- - Services, ambiance, produits, budget indicatif : déclarés, jamais inventés.
-- - Horaires : affichés « vérifiés » seulement avec une date de vérification
--   récente et une source ; sinon « à confirmer ».
-- - Revendication par l'exploitant, validée par l'équipe locale.
-- - Mise en avant sponsorisée : bloc séparé et étiqueté, sans effet sur l'ordre.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Référentiel : vues spécialisées (sous-catégories des commerces) et mots-clés
-- -----------------------------------------------------------------------------
insert into public.categories (parent_id, family, slug, name, content_types, sort_order, keywords)
select parent.id, parent.family, 'auto-moto', 'Auto, moto et pièces', '{place,business}'::public.content_type[], 50,
       '{pieces auto,pieces detachees,pneus,lubrifiant,concessionnaire,moto,station-service}'::text[]
from public.categories parent where parent.slug = 'commerces-boutiques'
on conflict (slug) do nothing;

update public.categories c set keywords = v.keywords::text[]
from (values
  ('restaurants-gastronomie', '{restaurant,maquis,garba,allocodrome,attieke,poisson braise,fast-food,pizzeria,cafe,brunch}'),
  ('alimentation', '{supermarche,superette,epicerie,boulangerie,patisserie,boucherie,poissonnerie,marche,fruits,legumes}'),
  ('mode-beaute', '{boutique,vetements,chaussures,pagne,cosmetiques,parfumerie,bijoux,salon}'),
  ('quincaillerie-materiaux', '{quincaillerie,materiaux,ciment,fer,peinture,outillage,plomberie,electricite}'),
  ('telephonie-informatique', '{telephone,smartphone,ordinateur,accessoires,recharge,credit,mobile money,informatique}')
) as v(slug, keywords)
where c.slug = v.slug and c.keywords = '{}';

-- -----------------------------------------------------------------------------
-- Vitrine : attributs déclarés, horaires sourcés, gérant validé
-- -----------------------------------------------------------------------------
-- Horaires : {"lun": [["08:00","12:30"],["14:00","19:00"]], …}, jours lun…dim,
-- 4 plages au plus par jour, fin après le début (24:00 accepté).
create or replace function public.valid_opening_hours(p_hours jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p_hours is null or (
    jsonb_typeof(p_hours) = 'object'
    and not exists (select 1 from jsonb_object_keys(p_hours) k where k not in ('lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'))
    and not exists (
      select 1 from jsonb_each(p_hours) d
      where jsonb_typeof(d.value) <> 'array'
         or jsonb_array_length(d.value) > 4
         or exists (
           select 1 from jsonb_array_elements(d.value) s
           where jsonb_typeof(s) <> 'array'
              or jsonb_array_length(s) <> 2
              or coalesce(s ->> 0, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              or coalesce(s ->> 1, '') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
              or (s ->> 1) <= (s ->> 0)))
  )
$$;

alter table public.places
  add column features text[] not null default '{}' check (features <@ array[
    'livraison', 'a_emporter', 'sur_place', 'reservation', 'paiement_mobile', 'carte_bancaire',
    'parking', 'climatise', 'wifi', 'terrasse', 'acces_facile']::text[]),
  add column ambiance text[] not null default '{}' check (ambiance <@ array[
    'familiale', 'calme', 'festive', 'decontractee', 'chic', 'plein_air']::text[]),
  add column products text[] not null default '{}' check (cardinality(products) <= 40),
  add column opening_hours_verified_at timestamptz,
  add column opening_hours_source_id uuid references public.sources (id) on delete set null,
  -- Exploitant dont la revendication a été validée (destinataire des messages).
  add column manager_id uuid references public.profiles (id) on delete set null,
  add constraint places_opening_hours_valid check (public.valid_opening_hours(opening_hours)),
  add constraint places_opening_hours_traceable check (opening_hours_verified_at is null or opening_hours_source_id is not null);

create index places_manager_idx on public.places (manager_id) where manager_id is not null;

-- Vérification des horaires et désignation du gérant : équipe locale seulement.
-- Toute autre modification des horaires les repasse « à confirmer ».
create or replace function public.protect_place_curation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_service_context() or public.is_service_request() or public.is_curator() or public.is_staff() then
    return new;
  end if;
  if new.manager_id is distinct from (case when tg_op = 'INSERT' then null else old.manager_id end) then
    raise exception 'Le gérant d''une vitrine est désigné par l''équipe locale.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.opening_hours is distinct from old.opening_hours
     or new.opening_hours_verified_at is distinct from old.opening_hours_verified_at
     or new.opening_hours_source_id is distinct from old.opening_hours_source_id then
    new.opening_hours_verified_at := null;
    new.opening_hours_source_id := null;
  end if;
  return new;
end;
$$;
create trigger places_protect_curation before insert or update on public.places
  for each row execute function public.protect_place_curation();

-- -----------------------------------------------------------------------------
-- Revendication d'une vitrine
-- -----------------------------------------------------------------------------
create table public.place_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  claimant_role text not null check (claimant_role in ('proprietaire', 'gerant', 'salarie')),
  message text not null check (char_length(message) between 10 and 2000),
  -- Élément vérifiable : registre du commerce, facture, carte professionnelle…
  evidence text not null check (char_length(evidence) between 3 and 500),
  phone text not null check (char_length(phone) between 6 and 30),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index place_claims_one_pending on public.place_claims (place_id, claimant_id) where status = 'pending';
create index place_claims_pending_idx on public.place_claims (created_at) where status = 'pending';
alter table public.place_claims enable row level security;

create policy place_claims_select on public.place_claims for select to authenticated
  using (claimant_id = (select auth.uid()) or (select public.is_curator()) or (select public.is_staff()));
create policy place_claims_insert on public.place_claims for insert to authenticated
  with check (claimant_id = (select auth.uid()) and not (select public.is_suspended()));
-- Aucune modification directe : la décision passe par review_place_claim.

create or replace function public.enforce_place_claim_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_request() then
    return new;
  end if;
  if not exists (select 1 from public.places p where p.id = new.place_id and p.kind = 'etablissement' and p.status = 'published') then
    raise exception 'Cette vitrine ne peut pas être revendiquée.' using errcode = '23514';
  end if;
  if exists (select 1 from public.places p where p.id = new.place_id and p.manager_id is not null) then
    raise exception 'Cette vitrine est déjà gérée par son exploitant. Contactez l''équipe en cas d''erreur.' using errcode = '23514';
  end if;
  if (select count(*) from public.place_claims where claimant_id = new.claimant_id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Trop de demandes en peu de temps. Réessayez demain.' using errcode = 'CP429';
  end if;
  new.status := 'pending';
  new.decision_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;
create trigger place_claims_rules before insert on public.place_claims
  for each row execute function public.enforce_place_claim_rules();

-- Décision de l'équipe locale : validation (gérant désigné, autres demandes closes) ou refus motivé.
create or replace function public.review_place_claim(p_claim uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.place_claims;
  v_place public.places;
begin
  if not (public.is_curator() or public.is_admin()) then
    raise exception 'Décision réservée à l''équipe locale.' using errcode = '42501';
  end if;
  select * into v_claim from public.place_claims where id = p_claim for update;
  if v_claim.id is null or v_claim.status <> 'pending' then
    raise exception 'Demande introuvable ou déjà traitée.' using errcode = '23514';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Motivez le refus (5 caractères au moins).' using errcode = '23514';
  end if;
  select * into v_place from public.places where id = v_claim.place_id for update;

  if p_approve then
    if v_place.manager_id is not null then
      raise exception 'Cette vitrine a déjà un gérant.' using errcode = '23514';
    end if;
    update public.places set manager_id = v_claim.claimant_id where id = v_place.id;
    update public.place_claims set status = 'rejected', decision_note = 'Une autre demande a été validée pour cette vitrine.',
           reviewed_by = (select auth.uid()), reviewed_at = now()
    where place_id = v_place.id and status = 'pending' and id <> v_claim.id;
  end if;
  update public.place_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = v_claim.id;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_claim.claimant_id, 'revendication',
          case when p_approve then 'Revendication validée : ' else 'Revendication refusée : ' end || v_place.name,
          nullif(btrim(coalesce(p_note, '')), ''), '/lieux/' || v_place.slug);
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'place_claim.approve' else 'place_claim.reject' end, 'place', v_place.id,
          jsonb_build_object('claim', v_claim.id, 'claimant', v_claim.claimant_id));
end;
$$;
revoke execute on function public.review_place_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_place_claim(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- « J'aime » d'une vitrine (public : seul le total est visible)
-- -----------------------------------------------------------------------------
create or replace function public.place_is_public(p_place uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.places p where p.id = p_place and p.status = 'published'
                 and public.verification_publicly_visible(p.verification_status))
$$;

create table public.place_likes (
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index place_likes_user_idx on public.place_likes (user_id);
alter table public.place_likes enable row level security;
create policy place_likes_select_own on public.place_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy place_likes_insert_own on public.place_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.place_is_public(place_id) and not (select public.is_suspended()));
create policy place_likes_delete_own on public.place_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.place_engagement(p_place uuid)
returns table (likes bigint, liked boolean, favorite boolean)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.place_likes where place_id = p_place),
    exists (select 1 from public.place_likes where place_id = p_place and user_id = (select auth.uid())),
    exists (select 1 from public.favorites where place_id = p_place and user_id = (select auth.uid()))
  where public.place_is_public(p_place)
$$;
revoke execute on function public.place_engagement(uuid) from public;
grant execute on function public.place_engagement(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Messagerie : écrire à l'exploitant d'une vitrine revendiquée
-- -----------------------------------------------------------------------------
create or replace function public.start_place_conversation(p_place uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_manager uuid;
  v_conversation uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour écrire à ce commerce.' using errcode = '42501';
  end if;
  if public.is_suspended() then
    raise exception 'Compte suspendu.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'Message vide ou trop long.' using errcode = '23514';
  end if;
  select manager_id into v_manager from public.places where id = p_place and public.place_is_public(id);
  if v_manager is null then
    raise exception 'Cette vitrine n''est pas encore gérée par son exploitant : la messagerie n''est pas disponible.' using errcode = '23514';
  end if;
  if v_manager = v_uid then
    raise exception 'Vous gérez cette vitrine.' using errcode = '23514';
  end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = v_uid
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = v_manager
  where c.place_id = p_place
  limit 1;

  if v_conversation is null then
    if (select count(*) from public.conversations where created_by = v_uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Trop de nouvelles conversations en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
    end if;
    insert into public.conversations (created_by, place_id) values (v_uid, p_place) returning id into v_conversation;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conversation, v_uid, now()), (v_conversation, v_manager, null);
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_uid, btrim(p_body));
  update public.conversation_participants set last_read_at = now(), is_archived = false
  where conversation_id = v_conversation and user_id = v_uid;
  return v_conversation;
end;
$$;
revoke execute on function public.start_place_conversation(uuid, text) from public, anon;
grant execute on function public.start_place_conversation(uuid, text) to authenticated;

-- Conversations et en-tête : le sujet peut être une annonce ou une vitrine.
drop function public.my_conversations();
create function public.my_conversations()
returns table (
  conversation_id uuid,
  other_name text,
  listing_title text,
  listing_slug text,
  place_name text,
  place_slug text,
  last_message text,
  last_message_mine boolean,
  last_message_at timestamptz,
  unread bigint
)
language sql stable security definer set search_path = '' as $$
  select c.id,
         coalesce(op.display_name, 'Membre'),
         l.title,
         l.slug,
         p.name,
         p.slug,
         left(m.body, 140),
         m.sender_id = me.user_id,
         coalesce(c.last_message_at, c.created_at),
         (select count(*) from public.messages x
           where x.conversation_id = c.id and x.sender_id <> me.user_id and x.deleted_at is null
             and (me.last_read_at is null or x.created_at > me.last_read_at))
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> me.user_id
  left join public.profiles op on op.id = other.user_id
  left join public.listings l on l.id = c.listing_id
  left join public.places p on p.id = c.place_id
  left join lateral (
    select body, sender_id from public.messages where conversation_id = c.id and deleted_at is null order by created_at desc limit 1
  ) m on true
  where me.user_id = (select auth.uid()) and not me.is_archived
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

drop function public.conversation_header(uuid);
create function public.conversation_header(p_conversation uuid)
returns table (
  other_name text, other_id uuid,
  listing_id uuid, listing_title text, listing_slug text, listing_active boolean,
  place_name text, place_slug text
)
language sql stable security definer set search_path = '' as $$
  select coalesce(op.display_name, 'Membre'), other.user_id, l.id, l.title, l.slug, coalesce(public.listing_is_contactable(l.id), false),
         p.name, p.slug
  from public.conversations c
  left join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> (select auth.uid())
  left join public.profiles op on op.id = other.user_id
  left join public.listings l on l.id = c.listing_id
  left join public.places p on p.id = c.place_id
  where c.id = p_conversation and public.is_conversation_participant(c.id)
  limit 1
$$;

revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.conversation_header(uuid) from public, anon;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.conversation_header(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Recherche de commerces (droits de l'appelant)
-- Ordre public : vérification à jour, horaires vérifiés, fiche la plus
-- récemment mise à jour ; ou distance si demandée. Les sponsorisés n'y
-- changent rien (bloc séparé).
-- -----------------------------------------------------------------------------
create or replace function public.search_shops(
  p_city uuid,
  p_categories uuid[] default null,
  p_query text default null,
  p_neighborhood uuid default null,
  p_budget_max smallint default null,
  p_ambiance text[] default null,
  p_features text[] default null,
  p_verified_only boolean default false,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null,
  p_sort text default 'pertinence',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (id uuid, distance_m double precision, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with point as (
    select case when p_lat between -90 and 90 and p_lng between -180 and 180
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end as geo
  ),
  matches as (
    select p.id,
      case when pt.geo is not null and p.location is not null then extensions.st_distance(p.location, pt.geo) end as distance_m,
      (p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days') as verified,
      (p.opening_hours_verified_at >= now() - interval '180 days') as hours_verified,
      p.updated_at
    from public.places p, point pt
    where p.city_id = p_city
      and p.kind = 'etablissement'
      and p.status = 'published'
      and public.verification_publicly_visible(p.verification_status)
      and (p_categories is null or p.category_id = any (p_categories))
      and (public.search_normalize(p_query) = ''
        or p.search_vector @@ public.search_tsquery(p_query)
        or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(p.name)
        or exists (select 1 from unnest(p.products) s where public.immutable_unaccent(lower(s)) like '%' || public.search_normalize(p_query) || '%'))
      and (p_neighborhood is null or p.neighborhood_id = p_neighborhood)
      and (p_budget_max is null or p.price_level <= p_budget_max)
      and (p_ambiance is null or cardinality(p_ambiance) = 0 or p.ambiance && p_ambiance)
      and (p_features is null or p.features @> p_features)
      and (not p_verified_only or (p.verification_status = 'verified' and p.verified_at >= now() - interval '365 days'))
      and (p_radius_m is null or pt.geo is null
        or (p.location is not null and extensions.st_dwithin(p.location, pt.geo, least(greatest(p_radius_m, 100), 100000))))
  )
  select m.id, m.distance_m, count(*) over ()
  from matches m
  order by
    case when p_sort = 'proximite' then m.distance_m end asc nulls last,
    m.verified desc,
    m.hours_verified desc nulls last,
    m.updated_at desc,
    m.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.search_shops(uuid, uuid[], text, uuid, smallint, text[], text[], boolean, double precision, double precision, integer, text, integer, integer) from public;
grant execute on function public.search_shops(uuid, uuid[], text, uuid, smallint, text[], text[], boolean, double precision, double precision, integer, text, integer, integer) to anon, authenticated;

-- Vitrines sponsorisées en cours (campagne active, payée, dans ses dates) : 2 au plus.
create or replace function public.sponsored_shops(p_city uuid, p_categories uuid[] default null, p_limit integer default 2)
returns table (id uuid, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select distinct on (p.id) p.id, sc.ends_at
  from public.sponsored_campaigns sc
  join public.places p on p.id = sc.place_id
  where sc.status = 'active'
    and now() between sc.starts_at and sc.ends_at
    and sc.placement = 'category'
    and sc.city_id = p_city
    and p.kind = 'etablissement'
    and public.place_is_public(p.id)
    and (p_categories is null or p.category_id = any (p_categories))
  order by p.id, sc.ends_at
  limit least(greatest(coalesce(p_limit, 2), 0), 4)
$$;
revoke execute on function public.sponsored_shops(uuid, uuid[], integer) from public;
grant execute on function public.sponsored_shops(uuid, uuid[], integer) to anon, authenticated;
