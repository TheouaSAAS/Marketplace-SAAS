-- =============================================================================
-- Niveau 8 : détail d'annonce, favoris, « j'aime », commentaires, contact,
-- messagerie, vues, signalements.
--
-- Principes :
-- - une annonce n'est sollicitable (contact, coordonnées, commentaire) que si
--   elle est publiée, active, non indisponible et son annonceur non suspendu ;
-- - les coordonnées ne sont jamais lisibles directement : elles ne sont
--   révélées qu'avec l'accord de l'annonceur, à un membre connecté, dans une
--   limite horaire, et chaque révélation est tracée (90 jours) ;
-- - les limites anti-abus sont en base : elles valent aussi pour un appel
--   direct à l'API, pas seulement pour l'interface.
-- Code d'erreur « CP429 » : limite atteinte (l'interface affiche le message).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- États d'une annonce
-- -----------------------------------------------------------------------------
create or replace function public.listing_is_public(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing
      and l.status = 'published'
      and (l.expires_at is null or l.expires_at > now())
      and public.verification_publicly_visible(l.verification_status)
  )
$$;

create or replace function public.listing_is_contactable(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l join public.profiles p on p.id = l.owner_id
    where l.id = p_listing
      and l.status = 'published'
      and (l.expires_at is null or l.expires_at > now())
      and public.verification_publicly_visible(l.verification_status)
      and l.availability_status <> 'unavailable'
      and not p.is_suspended
  )
$$;

create or replace function public.listing_is_manageable(p_listing uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing and (public.can_manage_content(l.owner_id, l.organization_id) or public.is_staff())
  )
$$;

-- Annonce qui a été publique mais ne l'est plus (expirée, archivée) : la page
-- l'indique au lieu d'une erreur. Un brouillon, une annonce refusée ou en
-- attente restent introuvables (aucune fuite).
create or replace function public.listing_public_state(p_slug text)
returns table (listing_id uuid, state text, title text, category_id uuid, city_id uuid)
language sql stable security definer set search_path = '' as $$
  select l.id, case when l.status = 'archived' then 'archived' else 'expired' end, l.title, l.category_id, l.city_id
  from public.listings l
  where l.slug = p_slug
    and l.published_at is not null
    and public.verification_publicly_visible(l.verification_status)
    and (l.status in ('expired', 'archived') or (l.status = 'published' and l.expires_at <= now()))
$$;

-- Position publique en coordonnées (droits de l'appelant : jamais la position exacte).
create or replace function public.listing_public_point(p_listing uuid)
returns table (lat double precision, lng double precision, location_precision public.public_location_precision)
language sql stable security invoker set search_path = '' as $$
  select extensions.st_y(l.location_public::extensions.geometry), extensions.st_x(l.location_public::extensions.geometry), l.public_location_precision
  from public.listings l
  where l.id = p_listing and l.location_public is not null
$$;

-- -----------------------------------------------------------------------------
-- Profil public de l'annonceur : le strict nécessaire, pour une annonce visible
-- -----------------------------------------------------------------------------
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
    coalesce(p.display_name, 'Membre'),
    p.avatar_url,
    p.created_at,
    p.role = 'professional' or l.organization_id is not null,
    o.name,
    (select count(*) from public.listings x
      where x.owner_id = l.owner_id and x.status = 'published'
        and (x.expires_at is null or x.expires_at > now())
        and public.verification_publicly_visible(x.verification_status))
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  left join public.organizations o on o.id = l.organization_id
  where l.id = p_listing and (public.listing_is_public(l.id) or public.listing_is_manageable(l.id))
$$;

-- -----------------------------------------------------------------------------
-- « J'aime » (public : seul le total est visible)
-- -----------------------------------------------------------------------------
create table public.listing_likes (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
create index listing_likes_user_idx on public.listing_likes (user_id);
alter table public.listing_likes enable row level security;
create policy listing_likes_select_own on public.listing_likes for select to authenticated
  using (user_id = (select auth.uid()));
create policy listing_likes_insert_own on public.listing_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.listing_is_public(listing_id) and not (select public.is_suspended()));
create policy listing_likes_delete_own on public.listing_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Vues : une par visiteur et par jour, sans donnée personnelle
-- L'empreinte est calculée par le serveur (HMAC secret, renouvelée chaque jour) ;
-- les marques sont purgées après 2 jours. Le compteur est séparé de l'annonce
-- (une vue ne modifie ni sa date de mise à jour ni son historique).
-- -----------------------------------------------------------------------------
create table public.listing_view_counts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  views integer not null default 0 check (views >= 0),
  updated_at timestamptz not null default now()
);
create table public.listing_view_marks (
  listing_id uuid not null references public.listings (id) on delete cascade,
  viewer_hash text not null check (char_length(viewer_hash) = 64),
  day date not null default current_date,
  primary key (listing_id, viewer_hash, day)
);
alter table public.listing_view_counts enable row level security;
alter table public.listing_view_marks enable row level security;

create or replace function public.record_listing_view(p_listing uuid, p_viewer_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.listing_is_public(p_listing) then
    return false;
  end if;
  insert into public.listing_view_marks (listing_id, viewer_hash) values (p_listing, p_viewer_hash)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.listing_view_counts as c (listing_id, views) values (p_listing, 1)
  on conflict (listing_id) do update set views = c.views + 1, updated_at = now();
  return true;
end;
$$;
revoke execute on function public.record_listing_view(uuid, text) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Commentaires publics (questions sur l'annonce)
-- Sans coordonnées (téléphone, e-mail) : l'échange privé passe par la messagerie.
-- Seul l'annonceur répond ; il peut masquer un commentaire ; l'équipe modère.
-- -----------------------------------------------------------------------------
create type public.comment_status as enum ('visible', 'hidden', 'deleted');

create table public.listing_comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.listing_comments (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000),
  status public.comment_status not null default 'visible',
  hidden_reason text check (hidden_reason is null or char_length(hidden_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listing_comments_listing_idx on public.listing_comments (listing_id, created_at);
create index listing_comments_author_idx on public.listing_comments (author_id, created_at desc);
create trigger listing_comments_updated_at before update on public.listing_comments
  for each row execute function public.set_updated_at();
alter table public.listing_comments enable row level security;

create policy listing_comments_select on public.listing_comments for select using (
  (status = 'visible' and public.listing_is_public(listing_id))
  or author_id = (select auth.uid())
  or public.listing_is_manageable(listing_id)
);
create policy listing_comments_insert on public.listing_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and not (select public.is_suspended()));
create policy listing_comments_update on public.listing_comments for update to authenticated
  using (author_id = (select auth.uid()) or public.listing_is_manageable(listing_id));

-- Coordonnées dans un texte public : suite d'au moins 8 chiffres (espaces,
-- points, tirets tolérés) ou adresse e-mail.
create or replace function public.contains_contact_details(p_text text)
returns boolean language sql immutable set search_path = '' as $$
  select p_text ~ '(\+?\d[\s.\-]?){8,}' or p_text ~* '[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}'
$$;

create or replace function public.enforce_comment_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_manager boolean := public.listing_is_manageable(new.listing_id);
  v_parent public.listing_comments;
begin
  if public.is_service_request() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.listing_is_contactable(new.listing_id) then
      raise exception 'Cette annonce n''accepte plus de commentaires.' using errcode = '23514';
    end if;
    if public.contains_contact_details(new.body) then
      raise exception 'Pas de téléphone ni d''e-mail dans un commentaire public : utilisez la messagerie.' using errcode = '23514';
    end if;
    if (select count(*) from public.listing_comments
        where author_id = new.author_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Trop de commentaires en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
    end if;
    if new.parent_id is not null then
      select * into v_parent from public.listing_comments where id = new.parent_id;
      if v_parent.id is null or v_parent.listing_id <> new.listing_id or v_parent.parent_id is not null then
        raise exception 'Réponse invalide.' using errcode = '23514';
      end if;
      if not v_manager then
        raise exception 'Seul l''annonceur répond aux commentaires.' using errcode = '42501';
      end if;
    end if;
    new.status := 'visible';
    new.hidden_reason := null;
    return new;
  end if;

  -- Mise à jour : seul le statut change, selon le rôle.
  if new.body is distinct from old.body or new.listing_id <> old.listing_id or new.author_id <> old.author_id
     or new.parent_id is distinct from old.parent_id then
    raise exception 'Un commentaire publié ne se modifie pas : supprimez-le et écrivez-en un nouveau.' using errcode = '42501';
  end if;
  if public.is_staff() then
    return new;
  end if;
  if old.author_id = v_uid and new.status = 'deleted' then
    new.hidden_reason := null;
    return new;
  end if;
  if v_manager and old.status <> 'deleted' and new.status in ('visible', 'hidden') then
    return new;
  end if;
  raise exception 'Modification non autorisée.' using errcode = '42501';
end;
$$;
create trigger listing_comments_rules before insert or update on public.listing_comments
  for each row execute function public.enforce_comment_rules();

-- Fil public : commentaires visibles avec le nom affiché de leur auteur.
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
  select c.id, c.parent_id, c.body, c.created_at, coalesce(p.display_name, 'Membre'),
         c.author_id = l.owner_id or exists (
           select 1 from public.organization_members m
           where m.organization_id = l.organization_id and m.user_id = c.author_id and m.role in ('owner', 'admin', 'editor')
         ),
         coalesce(c.author_id = (select auth.uid()), false)
  from public.listing_comments c
  join public.listings l on l.id = c.listing_id
  join public.profiles p on p.id = c.author_id
  where c.listing_id = p_listing
    and c.status = 'visible'
    and (public.listing_is_public(l.id) or public.listing_is_manageable(l.id))
  order by coalesce(c.parent_id, c.id), c.parent_id nulls first, c.created_at
$$;

-- -----------------------------------------------------------------------------
-- Total public de l'engagement
-- -----------------------------------------------------------------------------
create or replace function public.listing_engagement(p_listing uuid)
returns table (likes bigint, liked boolean, comments bigint, views integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.listing_likes where listing_id = p_listing),
    exists (select 1 from public.listing_likes where listing_id = p_listing and user_id = (select auth.uid())),
    (select count(*) from public.listing_comments where listing_id = p_listing and status = 'visible'),
    coalesce((select views from public.listing_view_counts where listing_id = p_listing), 0)
  where public.listing_is_public(p_listing) or public.listing_is_manageable(p_listing)
$$;

-- -----------------------------------------------------------------------------
-- Coordonnées : révélées avec l'accord de l'annonceur, à un membre connecté
-- -----------------------------------------------------------------------------
create table public.contact_reveals (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('phone', 'whatsapp', 'email')),
  created_at timestamptz not null default now()
);
create index contact_reveals_user_idx on public.contact_reveals (user_id, created_at desc);
create index contact_reveals_listing_idx on public.contact_reveals (listing_id, created_at desc);
alter table public.contact_reveals enable row level security;

create or replace function public.reveal_listing_contact(p_listing uuid, p_channel text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_listing public.listings;
  v_value text;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour voir les coordonnées.' using errcode = '42501';
  end if;
  if public.is_suspended() then
    raise exception 'Compte suspendu.' using errcode = '42501';
  end if;
  if p_channel not in ('phone', 'whatsapp', 'email') then
    raise exception 'Canal inconnu.' using errcode = '22023';
  end if;
  select * into v_listing from public.listings where id = p_listing;
  if v_listing.id is null or not public.listing_is_contactable(p_listing) then
    raise exception 'Cette annonce n''est plus disponible.' using errcode = '23514';
  end if;

  v_value := case p_channel
    when 'phone' then case when v_listing.show_phone then v_listing.contact_phone end
    when 'whatsapp' then case when v_listing.show_whatsapp then v_listing.contact_whatsapp end
    else case when v_listing.show_email then v_listing.contact_email end
  end;
  if nullif(btrim(v_value), '') is null then
    raise exception 'L''annonceur ne partage pas cette coordonnée : utilisez la messagerie.' using errcode = '23514';
  end if;

  if v_listing.owner_id <> v_uid then
    if (select count(*) from public.contact_reveals where user_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Trop de coordonnées consultées en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
    end if;
    insert into public.contact_reveals (listing_id, user_id, channel) values (p_listing, v_uid, p_channel);
  end if;
  return v_value;
end;
$$;
revoke execute on function public.reveal_listing_contact(uuid, text) from public, anon;
grant execute on function public.reveal_listing_contact(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Messagerie : démarrer (ou reprendre) une conversation à propos d'une annonce
-- -----------------------------------------------------------------------------
create or replace function public.start_listing_conversation(p_listing uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_conversation uuid;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour écrire à l''annonceur.' using errcode = '42501';
  end if;
  if public.is_suspended() then
    raise exception 'Compte suspendu.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 2 and 4000 then
    raise exception 'Message vide ou trop long.' using errcode = '23514';
  end if;
  select owner_id into v_owner from public.listings where id = p_listing;
  if v_owner is null or not public.listing_is_contactable(p_listing) then
    raise exception 'Cette annonce n''est plus disponible.' using errcode = '23514';
  end if;
  if v_owner = v_uid then
    raise exception 'C''est votre propre annonce.' using errcode = '23514';
  end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = v_uid
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = v_owner
  where c.listing_id = p_listing
  limit 1;

  if v_conversation is null then
    if (select count(*) from public.conversations where created_by = v_uid and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Trop de nouvelles conversations en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
    end if;
    insert into public.conversations (created_by, listing_id) values (v_uid, p_listing) returning id into v_conversation;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conversation, v_uid, now()), (v_conversation, v_owner, null);
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_uid, btrim(p_body));
  update public.conversation_participants set last_read_at = now(), is_archived = false
  where conversation_id = v_conversation and user_id = v_uid;
  return v_conversation;
end;
$$;
revoke execute on function public.start_listing_conversation(uuid, text) from public, anon;
grant execute on function public.start_listing_conversation(uuid, text) to authenticated;

-- Débit des messages : 15 par minute et 200 par heure et par expéditeur.
create or replace function public.limit_message_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 15
     or (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Trop de messages envoyés en peu de temps. Patientez un instant.' using errcode = 'CP429';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.limit_message_rate();

-- Conversations du membre connecté, avec l'interlocuteur et l'annonce.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_name text,
  listing_title text,
  listing_slug text,
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
  left join lateral (
    select body, sender_id from public.messages where conversation_id = c.id and deleted_at is null order by created_at desc limit 1
  ) m on true
  where me.user_id = (select auth.uid()) and not me.is_archived
  order by coalesce(c.last_message_at, c.created_at) desc
$$;

-- En-tête d'une conversation (participants uniquement).
create or replace function public.conversation_header(p_conversation uuid)
returns table (other_name text, other_id uuid, listing_id uuid, listing_title text, listing_slug text, listing_active boolean)
language sql stable security definer set search_path = '' as $$
  select coalesce(op.display_name, 'Membre'), other.user_id, l.id, l.title, l.slug, coalesce(public.listing_is_contactable(l.id), false)
  from public.conversations c
  left join public.conversation_participants other on other.conversation_id = c.id and other.user_id <> (select auth.uid())
  left join public.profiles op on op.id = other.user_id
  left join public.listings l on l.id = c.listing_id
  where c.id = p_conversation and public.is_conversation_participant(c.id)
  limit 1
$$;

revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.conversation_header(uuid) from public, anon;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.conversation_header(uuid) to authenticated;

-- Temps réel : nouveaux messages diffusés aux seuls participants (règles d'accès appliquées).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Signalements : aussi pour un commentaire ; un seul signalement ouvert par
-- personne et par contenu ; 10 par heure au plus.
-- -----------------------------------------------------------------------------
alter table public.reports add column comment_id uuid references public.listing_comments (id) on delete cascade;
do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.reports'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%num_nonnulls%';
  if v_name is not null then
    execute format('alter table public.reports drop constraint %I', v_name);
  end if;
end $$;
alter table public.reports add constraint reports_single_target
  check (num_nonnulls(listing_id, place_id, event_id, business_id, comment_id) = 1);
create unique index reports_open_once on public.reports (reporter_id, coalesce(listing_id, place_id, event_id, business_id, comment_id))
  where status in ('open', 'reviewing') and reporter_id is not null;

create or replace function public.limit_report_rate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.reporter_id is not null
     and (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de signalements en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
  end if;
  new.status := 'open';
  return new;
end;
$$;
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.limit_report_rate();

-- -----------------------------------------------------------------------------
-- Droits d'exécution et purges
-- -----------------------------------------------------------------------------
revoke execute on function public.listing_is_manageable(uuid) from public;
grant execute on function public.listing_is_manageable(uuid) to anon, authenticated;

select cron.schedule('purger-vues-annonces', '20 3 * * *', $$delete from public.listing_view_marks where day < current_date - 2$$);
select cron.schedule('purger-coordonnees-consultees', '25 3 * * *', $$delete from public.contact_reveals where created_at < now() - interval '90 days'$$);
