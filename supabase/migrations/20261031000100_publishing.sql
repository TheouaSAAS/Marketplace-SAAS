-- =============================================================================
-- Niveau 18 : publication d'annonce (brouillon, photos, suggestions tracées, IA)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Brouillons : un brouillon peut être incomplet ; les longueurs minimales
-- s'appliquent dès la soumission (et à tout contenu non brouillon).
-- -----------------------------------------------------------------------------
alter table public.listings drop constraint listings_title_check;
alter table public.listings add constraint listings_title_check
  check (char_length(title) <= 120 and (status = 'draft' or char_length(title) >= 5));
alter table public.listings drop constraint listings_description_check;
alter table public.listings add constraint listings_description_check
  check (char_length(description) <= 10000 and (status = 'draft' or char_length(description) >= 20));

-- -----------------------------------------------------------------------------
-- Photos : celles d'une annonce restent dans le stockage PRIVÉ (`private-media`,
-- auteur et équipe seulement) jusqu'à la publication, où l'équipe les copie dans
-- le stockage public. Empreinte SHA-256 pour repérer les doublons.
-- -----------------------------------------------------------------------------
alter table public.images
  add column bucket text not null default 'media' check (bucket in ('media', 'private-media')),
  add column content_hash text check (content_hash ~ '^[0-9a-f]{64}$'),
  add column byte_size integer check (byte_size > 0);
create index images_content_hash_idx on public.images (content_hash) where content_hash is not null;

create or replace function public.protect_image()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  if public.is_staff() or public.is_service_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.listing_id is not null then
      -- Une photo d'annonce déposée par son auteur n'est jamais publique d'emblée.
      new.bucket := 'private-media';
      select count(*) into v_count from public.images where listing_id = new.listing_id;
      if v_count >= 10 then
        raise exception 'Dix photos au plus par annonce.' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;
  -- L'auteur ne modifie que le texte alternatif et l'ordre.
  if (new.bucket, new.storage_path, new.content_hash, new.byte_size, new.listing_id, new.place_id, new.event_id, new.business_id, new.owner_id)
     is distinct from
     (old.bucket, old.storage_path, old.content_hash, old.byte_size, old.listing_id, old.place_id, old.event_id, old.business_id, old.owner_id) then
    raise exception 'Seuls la légende et l''ordre d''une photo sont modifiables.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger images_protect before insert or update on public.images
  for each row execute function public.protect_image();

-- Doublons d'une photo : mêmes octets déjà présents dans une autre annonce
-- (de l'auteur ou d'un autre compte). Aucun détail sur les autres annonces.
create or replace function public.listing_image_duplicates(p_listing uuid)
returns table (image_id uuid, own_matches integer, other_matches integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.listings l
    where l.id = p_listing and (public.can_manage_content(l.owner_id, l.organization_id) or public.is_staff())
  ) then
    return;
  end if;
  return query
  select i.id,
         count(*) filter (where o.owner_id = i.owner_id)::integer,
         count(*) filter (where o.owner_id <> i.owner_id)::integer
  from public.images i
  join public.images o on o.content_hash = i.content_hash and o.id <> i.id and o.listing_id is not null and o.listing_id <> i.listing_id
  where i.listing_id = p_listing and i.content_hash is not null
  group by i.id;
end;
$$;
revoke all on function public.listing_image_duplicates(uuid) from public, anon;
grant execute on function public.listing_image_duplicates(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Suggestions de l'assistant de saisie (règles ou IA) : tracées, jamais
-- appliquées sans décision de l'auteur. Rien ici n'écrit dans `listings`.
-- -----------------------------------------------------------------------------
create table public.listing_suggestions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  field text not null check (field ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)?$' and char_length(field) <= 60),
  value jsonb not null,
  origin text not null check (origin in ('regles', 'ia')),
  input_kind text not null check (input_kind in ('texte', 'photo', 'pdf')),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  excerpt text check (char_length(excerpt) <= 300),
  model text check (char_length(model) <= 80),
  status text not null default 'proposee' check (status in ('proposee', 'acceptee', 'rejetee', 'annulee')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index listing_suggestions_listing_idx on public.listing_suggestions (listing_id, created_at);

create or replace function public.protect_listing_suggestion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'proposee';
    new.decided_at := null;
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'decided_at') is distinct from (to_jsonb(old) - 'status' - 'decided_at') then
    raise exception 'Une suggestion ne se modifie pas : acceptez-la, rejetez-la ou annulez-la.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    if not ((old.status = 'proposee' and new.status in ('acceptee', 'rejetee')) or (old.status = 'acceptee' and new.status = 'annulee')) then
      raise exception 'Décision non autorisée (% → %).', old.status, new.status using errcode = '42501';
    end if;
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger listing_suggestions_protect before insert or update on public.listing_suggestions
  for each row execute function public.protect_listing_suggestion();

alter table public.listing_suggestions enable row level security;
create policy listing_suggestions_select on public.listing_suggestions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy listing_suggestions_insert on public.listing_suggestions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and public.can_manage_content(l.owner_id, l.organization_id))
  );
create policy listing_suggestions_update on public.listing_suggestions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.listing_suggestions from anon;
grant select, insert, update on public.listing_suggestions to authenticated;

-- -----------------------------------------------------------------------------
-- Consommation de l'IA : écrite par le serveur seul (clé secrète), pour tenir le
-- budget mensuel. Aucun contenu, seulement des volumes et un coût estimé.
-- -----------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  feature text not null check (feature in ('publication')),
  model text not null check (char_length(model) <= 80),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  cost_usd numeric(12, 6) not null check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_created_idx on public.ai_usage (created_at);
alter table public.ai_usage enable row level security;
create policy ai_usage_staff_read on public.ai_usage for select to authenticated using ((select public.is_admin()));
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

create or replace function public.ai_month_cost()
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage
  where created_at >= date_trunc('month', now() at time zone 'Africa/Abidjan') at time zone 'Africa/Abidjan'
$$;
revoke all on function public.ai_month_cost() from public, anon, authenticated;
grant execute on function public.ai_month_cost() to service_role;
