-- =============================================================================
-- Niveau 19 : profils professionnels (page, équipe, badges, avis, revendication)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Page professionnelle : FAQ, liens, fiche revendicable
-- -----------------------------------------------------------------------------
alter table public.business_profiles
  add column faq jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faq) = 'array' and jsonb_array_length(faq) <= 10),
  add column links jsonb not null default '[]'::jsonb
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 6),
  -- Fiche créée par l'équipe locale pour un professionnel qui ne la gère pas encore.
  add column is_claimed boolean not null default true;

-- Cinq pages au plus par compte (hors équipe).
create or replace function public.limit_business_profiles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not (public.is_staff() or public.is_curator() or public.is_service_context())
     and (select count(*) from public.business_profiles where owner_id = new.owner_id) >= 5 then
    raise exception 'Cinq pages professionnelles au plus par compte.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger business_profiles_limit before insert on public.business_profiles
  for each row execute function public.limit_business_profiles();

-- -----------------------------------------------------------------------------
-- Photos : celles d'une page professionnelle restent privées jusqu'à sa
-- publication, comme celles d'une annonce (niveau 18).
-- -----------------------------------------------------------------------------
create or replace function public.protect_image()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_count integer;
begin
  if public.is_staff() or public.is_service_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.listing_id is not null or new.business_id is not null then
      new.bucket := 'private-media';
      select count(*) into v_count from public.images
      where (new.listing_id is not null and listing_id = new.listing_id) or (new.business_id is not null and business_id = new.business_id);
      if new.listing_id is not null and v_count >= 10 then
        raise exception 'Dix photos au plus par annonce.' using errcode = '23514';
      end if;
      if new.business_id is not null and v_count >= 12 then
        raise exception 'Douze photos au plus par page professionnelle.' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;
  if (new.bucket, new.storage_path, new.content_hash, new.byte_size, new.listing_id, new.place_id, new.event_id, new.business_id, new.owner_id)
     is distinct from
     (old.bucket, old.storage_path, old.content_hash, old.byte_size, old.listing_id, old.place_id, old.event_id, old.business_id, old.owner_id) then
    raise exception 'Seuls la légende et l''ordre d''une photo sont modifiables.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Les membres « editor » d'une organisation gèrent aussi les photos de sa page.
drop policy images_insert on public.images;
create policy images_insert on public.images for insert to authenticated with check (
  owner_id = (select auth.uid())
  and split_part(storage_path, '/', 1) = (select auth.uid())::text
  and (
    (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id and public.can_manage_content(l.owner_id, l.organization_id)))
    or (place_id is not null and exists (select 1 from public.places p where p.id = place_id and p.created_by = (select auth.uid())))
    or (event_id is not null and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())))
    or (business_id is not null and exists (select 1 from public.business_profiles b where b.id = business_id and public.can_manage_content(b.owner_id, b.organization_id)))
    or (select public.is_staff())
  )
);
drop policy images_update on public.images;
create policy images_update on public.images for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff())
    or (business_id is not null and exists (select 1 from public.business_profiles b where b.id = business_id and public.can_manage_content(b.owner_id, b.organization_id))))
  with check (true);
drop policy images_delete on public.images;
create policy images_delete on public.images for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff())
    or (business_id is not null and exists (select 1 from public.business_profiles b where b.id = business_id and public.can_manage_content(b.owner_id, b.organization_id))));

-- -----------------------------------------------------------------------------
-- Revendication d'une page créée par l'équipe (même circuit que les vitrines)
-- -----------------------------------------------------------------------------
alter table public.place_claims alter column place_id drop not null;
alter table public.place_claims add column business_id uuid references public.business_profiles (id) on delete cascade;
alter table public.place_claims add constraint place_claims_single_target check (num_nonnulls(place_id, business_id) = 1);
create unique index place_claims_one_pending_business on public.place_claims (business_id, claimant_id) where status = 'pending' and business_id is not null;

create or replace function public.enforce_place_claim_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_request() then
    return new;
  end if;
  if new.business_id is not null then
    if not exists (select 1 from public.business_profiles b where b.id = new.business_id and b.status = 'published' and not b.is_claimed) then
      raise exception 'Cette page professionnelle est déjà gérée par son titulaire. Contactez l''équipe en cas d''erreur.' using errcode = '23514';
    end if;
  else
    if not exists (select 1 from public.places p where p.id = new.place_id and p.kind = 'etablissement' and p.status = 'published') then
      raise exception 'Cette vitrine ne peut pas être revendiquée.' using errcode = '23514';
    end if;
    if exists (select 1 from public.places p where p.id = new.place_id and p.manager_id is not null) then
      raise exception 'Cette vitrine est déjà gérée par son exploitant. Contactez l''équipe en cas d''erreur.' using errcode = '23514';
    end if;
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

-- Décision sur une revendication de page professionnelle : le demandeur en devient titulaire.
create or replace function public.review_business_claim(p_claim uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.place_claims;
  v_business public.business_profiles;
begin
  if not (public.is_curator() or public.is_admin()) then
    raise exception 'Décision réservée à l''équipe locale.' using errcode = '42501';
  end if;
  select * into v_claim from public.place_claims where id = p_claim and business_id is not null for update;
  if v_claim.id is null or v_claim.status <> 'pending' then
    raise exception 'Demande introuvable ou déjà traitée.' using errcode = '23514';
  end if;
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Motivez le refus (5 caractères au moins).' using errcode = '23514';
  end if;
  select * into v_business from public.business_profiles where id = v_claim.business_id for update;
  if p_approve then
    if v_business.is_claimed then
      raise exception 'Cette page a déjà un titulaire.' using errcode = '23514';
    end if;
    update public.business_profiles set owner_id = v_claim.claimant_id, is_claimed = true, organization_id = null where id = v_business.id;
    update public.place_claims set status = 'rejected', decision_note = 'Une autre demande a été validée pour cette page.',
           reviewed_by = (select auth.uid()), reviewed_at = now()
    where business_id = v_business.id and status = 'pending' and id <> v_claim.id;
  end if;
  update public.place_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = v_claim.id;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_claim.claimant_id, 'revendication',
          case when p_approve then 'Revendication validée : ' else 'Revendication refusée : ' end || v_business.name,
          nullif(btrim(coalesce(p_note, '')), ''), '/professionnels/' || v_business.slug);
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'business_claim.approve' else 'business_claim.reject' end, 'business', v_business.id,
          jsonb_build_object('claim', v_claim.id, 'claimant', v_claim.claimant_id));
end;
$$;
revoke execute on function public.review_business_claim(uuid, boolean, text) from public, anon;
grant execute on function public.review_business_claim(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Équipe : invitations par lien (aucun annuaire de comptes n'est exposé)
-- -----------------------------------------------------------------------------
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.organization_role not null check (role <> 'owner'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz
);
create index organization_invitations_org_idx on public.organization_invitations (organization_id, created_at desc);
alter table public.organization_invitations enable row level security;
create policy organization_invitations_select on public.organization_invitations for select to authenticated
  using (public.is_org_member(organization_id, 'admin') or (select public.is_admin()));
revoke all on public.organization_invitations from anon, authenticated;
grant select on public.organization_invitations to authenticated;

-- Crée une invitation et renvoie le lien secret UNE fois (seule son empreinte est gardée).
create or replace function public.create_organization_invitation(p_organization uuid, p_role public.organization_role)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_org_member(p_organization, 'admin') then
    raise exception 'Seuls les administrateurs de l''équipe invitent.' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'On n''invite pas un propriétaire : nommez-le depuis l''équipe.' using errcode = '23514';
  end if;
  if (select count(*) from public.organization_invitations
      where organization_id = p_organization and accepted_at is null and revoked_at is null and expires_at > now()) >= 20 then
    raise exception 'Trop d''invitations en attente : révoquez-en avant d''en créer.' using errcode = 'CP429';
  end if;
  insert into public.organization_invitations (organization_id, role, token_hash, created_by)
  values (p_organization, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), (select auth.uid()));
  return v_token;
end;
$$;

create or replace function public.revoke_organization_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.organization_invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null
    and public.is_org_member(organization_id, 'admin');
  if not found then
    raise exception 'Invitation introuvable ou déjà utilisée.' using errcode = '23514';
  end if;
end;
$$;

-- Ce que voit la personne invitée avant d'accepter.
create or replace function public.organization_invitation_preview(p_token text)
returns table (organization_name text, role public.organization_role, valid boolean)
language sql stable security definer set search_path = '' as $$
  select o.name, i.role, (i.accepted_at is null and i.revoked_at is null and i.expires_at > now() and not o.is_suspended)
  from public.organization_invitations i join public.organizations o on o.id = i.organization_id
  where (select auth.uid()) is not null and i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
$$;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_invitation public.organization_invitations;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  select * into v_invitation from public.organization_invitations
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') for update;
  if v_invitation.id is null or v_invitation.accepted_at is not null or v_invitation.revoked_at is not null or v_invitation.expires_at <= now() then
    raise exception 'Invitation invalide, expirée ou déjà utilisée.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.organization_members where organization_id = v_invitation.organization_id and user_id = v_user) then
    insert into public.organization_members (organization_id, user_id, role, invited_by)
    values (v_invitation.organization_id, v_user, v_invitation.role, v_invitation.created_by);
  end if;
  update public.organization_invitations set accepted_by = v_user, accepted_at = now() where id = v_invitation.id;
  if v_invitation.created_by is not null then
    insert into public.notifications (user_id, type, title, link)
    select v_invitation.created_by, 'equipe', 'Invitation acceptée : ' || coalesce(p.display_name, 'un membre') || ' a rejoint ' || o.name, '/mes-pages-pro'
    from public.organizations o left join public.profiles p on p.id = v_user
    where o.id = v_invitation.organization_id;
  end if;
  return v_invitation.organization_id;
end;
$$;

-- Membres d'une équipe avec leur nom public (les profils ne sont pas lisibles directement).
create or replace function public.organization_team(p_organization uuid)
returns table (member_id uuid, user_id uuid, display_name text, role public.organization_role, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.user_id, coalesce(p.display_name, 'Membre sans nom'), m.role, m.created_at
  from public.organization_members m left join public.profiles p on p.id = m.user_id
  where m.organization_id = p_organization and (public.is_org_member(p_organization) or public.is_staff())
  order by public.organization_role_rank(m.role) desc, m.created_at
$$;

revoke execute on function public.create_organization_invitation(uuid, public.organization_role) from public, anon;
revoke execute on function public.revoke_organization_invitation(uuid) from public, anon;
revoke execute on function public.organization_invitation_preview(text) from public, anon;
revoke execute on function public.accept_organization_invitation(text) from public, anon;
revoke execute on function public.organization_team(uuid) from public, anon;
grant execute on function public.create_organization_invitation(uuid, public.organization_role) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.organization_invitation_preview(text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.organization_team(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Demande de vérification : le professionnel la demande, l'équipe locale décide
-- avec une source ; « Vérifié » n'est jamais déclaratif.
-- -----------------------------------------------------------------------------
create table public.business_verification_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  evidence text not null check (char_length(evidence) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index business_verification_one_pending on public.business_verification_requests (business_id) where status = 'pending';
alter table public.business_verification_requests enable row level security;
create policy business_verification_select on public.business_verification_requests for select to authenticated using (
  (select public.is_curator()) or (select public.is_staff())
  or exists (select 1 from public.business_profiles b where b.id = business_id and public.can_manage_content(b.owner_id, b.organization_id))
);
create policy business_verification_insert on public.business_verification_requests for insert to authenticated with check (
  requested_by = (select auth.uid())
  and exists (select 1 from public.business_profiles b where b.id = business_id and b.status = 'published' and public.can_manage_content(b.owner_id, b.organization_id))
);
revoke all on public.business_verification_requests from anon;
grant select, insert on public.business_verification_requests to authenticated;

create or replace function public.protect_verification_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.status := 'pending';
  new.decision_note := null;
  new.decided_by := null;
  new.decided_at := null;
  return new;
end;
$$;
create trigger business_verification_protect before insert on public.business_verification_requests
  for each row execute function public.protect_verification_request();

create or replace function public.decide_business_verification(p_request uuid, p_approve boolean, p_source_title text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_request public.business_verification_requests;
  v_business public.business_profiles;
  v_source uuid;
begin
  if not public.is_curator() then
    raise exception 'Décision réservée à l''équipe locale.' using errcode = '42501';
  end if;
  select * into v_request from public.business_verification_requests where id = p_request for update;
  if v_request.id is null or v_request.status <> 'pending' then
    raise exception 'Demande introuvable ou déjà traitée.' using errcode = '23514';
  end if;
  select * into v_business from public.business_profiles where id = v_request.business_id for update;
  if p_approve then
    if char_length(btrim(coalesce(p_source_title, ''))) < 3 then
      raise exception 'Indiquez la source du contrôle (document vu, visite, registre…).' using errcode = '23514';
    end if;
    insert into public.sources (kind, title, created_by) values ('terrain', btrim(p_source_title), (select auth.uid())) returning id into v_source;
    update public.business_profiles
    set verification_status = 'verified', source_id = v_source, verified_by = (select auth.uid()), verified_at = now(),
        verification_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = v_business.id;
  elsif char_length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Motivez le refus (5 caractères au moins).' using errcode = '23514';
  end if;
  update public.business_verification_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = (select auth.uid()), decided_at = now()
  where id = v_request.id;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_request.requested_by, 'verification',
          case when p_approve then 'Page vérifiée : ' else 'Vérification refusée : ' end || v_business.name,
          nullif(btrim(coalesce(p_note, '')), ''), '/professionnels/' || v_business.slug);
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_approve then 'business.verify' else 'business.verify_reject' end, 'business', v_business.id,
          jsonb_build_object('request', v_request.id, 'source', v_source));
end;
$$;
revoke execute on function public.decide_business_verification(uuid, boolean, text, text) from public, anon;
grant execute on function public.decide_business_verification(uuid, boolean, text, text) to authenticated;

-- Badges publics calculés en base : « sponsorisé » (campagne active) et
-- « en cours de validation » (demande de vérification en attente).
create or replace function public.business_public_badges(p_ids uuid[])
returns table (business_id uuid, sponsored boolean, verification_pending boolean)
language sql stable security definer set search_path = '' as $$
  select b.id,
         exists (select 1 from public.sponsored_campaigns c
                 where c.business_id = b.id and c.status = 'active' and c.starts_at <= now() and c.ends_at > now()),
         exists (select 1 from public.business_verification_requests r where r.business_id = b.id and r.status = 'pending')
  from public.business_profiles b
  where b.id = any (p_ids) and b.status = 'published'
$$;
grant execute on function public.business_public_badges(uuid[]) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Avis : règles anti-manipulation, lecture publique sans données personnelles
-- -----------------------------------------------------------------------------
-- Compte d'au moins 7 jours, adresse confirmée.
create or replace function public.account_can_review(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join auth.users u on u.id = p.id
    where p.id = p_user and p.created_at <= now() - interval '7 days' and u.email_confirmed_at is not null
  )
$$;
revoke execute on function public.account_can_review(uuid) from public, anon, authenticated;

create or replace function public.enforce_review_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_owner uuid;
  v_org uuid;
  v_moderator boolean := public.is_staff() or public.is_service_context();
begin
  if new.place_id is not null then
    select coalesce(b.owner_id, p.created_by), p.organization_id into v_owner, v_org
    from public.places p left join public.business_profiles b on b.id = p.business_id where p.id = new.place_id;
  else
    select owner_id, organization_id into v_owner, v_org from public.business_profiles where id = new.business_id;
  end if;

  if tg_op = 'INSERT' then
    if v_owner = new.author_id or (v_org is not null and public.is_org_member(v_org)) then
      raise exception 'Vous ne pouvez pas évaluer votre propre établissement.' using errcode = '23514';
    end if;
    if not v_moderator then
      if not public.account_can_review(new.author_id) then
        raise exception 'Pour publier un avis, votre compte doit avoir au moins 7 jours et une adresse e-mail confirmée.' using errcode = '23514';
      end if;
      if (select count(*) from public.reviews where author_id = new.author_id and created_at > now() - interval '1 day') >= 5 then
        raise exception 'Cinq avis par jour au plus. Réessayez demain.' using errcode = 'CP429';
      end if;
      new.status := 'pending';
      new.response_body := null; new.response_by := null; new.response_at := null;
    end if;
    return new;
  end if;

  if v_moderator then
    return new;
  end if;
  if (select auth.uid()) = old.author_id then
    new.status := 'pending';
    new.response_body := old.response_body; new.response_by := old.response_by; new.response_at := old.response_at;
    new.author_id := old.author_id; new.place_id := old.place_id; new.business_id := old.business_id;
  elsif public.can_manage_content(v_owner, v_org) then
    new := jsonb_populate_record(new, to_jsonb(old) - array['response_body', 'response_at', 'response_by']);
    new.response_by := (select auth.uid());
    new.response_at := now();
  else
    raise exception 'Modification non autorisée.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Avis publiés d'une page, avec le nom public de l'auteur.
create or replace function public.business_reviews(p_business uuid, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, rating smallint, body text, created_at timestamptz, author_name text, response_body text, response_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.body, r.created_at, coalesce(p.display_name, 'Membre'), r.response_body, r.response_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  join public.business_profiles b on b.id = r.business_id and b.status = 'published'
  where r.business_id = p_business and r.status = 'published'
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)
$$;
create or replace function public.business_rating(p_business uuid)
returns table (review_count integer, average numeric)
language sql stable security definer set search_path = '' as $$
  select count(*)::integer, round(avg(r.rating)::numeric, 1)
  from public.reviews r join public.business_profiles b on b.id = r.business_id and b.status = 'published'
  where r.business_id = p_business and r.status = 'published'
$$;
grant execute on function public.business_reviews(uuid, integer, integer) to anon, authenticated;
grant execute on function public.business_rating(uuid) to anon, authenticated;

-- Avis reçus par une page (titulaire ou équipe), tous statuts, pour y répondre.
create or replace function public.received_business_reviews(p_business uuid)
returns table (id uuid, rating smallint, body text, status public.review_status, created_at timestamptz, author_name text, response_body text, response_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.body, r.status, r.created_at, coalesce(p.display_name, 'Membre'), r.response_body, r.response_at
  from public.reviews r left join public.profiles p on p.id = r.author_id
  join public.business_profiles b on b.id = r.business_id
  where r.business_id = p_business and r.status in ('published', 'pending') and public.can_manage_content(b.owner_id, b.organization_id)
  order by r.created_at desc
$$;
revoke execute on function public.received_business_reviews(uuid) from public, anon;
grant execute on function public.received_business_reviews(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Notifications : décision de modération (page, avis) et nouvel avis publié
-- -----------------------------------------------------------------------------
create or replace function public.notify_business_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' and new.status in ('published', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.owner_id, 'page_pro',
            case when new.status = 'published' then 'Page publiée : ' else 'Page refusée : ' end || new.name,
            case when new.status = 'rejected' then new.rejection_reason end,
            case when new.status = 'published' then '/professionnels/' || new.slug else '/mes-pages-pro/' || new.id end);
  end if;
  return new;
end;
$$;
create trigger business_profiles_notify_moderation after update of status on public.business_profiles
  for each row execute function public.notify_business_moderation();

create or replace function public.notify_review_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_business public.business_profiles;
begin
  if new.business_id is null or new.status is not distinct from old.status or old.status <> 'pending' then
    return new;
  end if;
  select * into v_business from public.business_profiles where id = new.business_id;
  insert into public.notifications (user_id, type, title, link)
  values (new.author_id, 'avis', case when new.status = 'published' then 'Avis publié : ' else 'Avis non publié : ' end || v_business.name, '/professionnels/' || v_business.slug);
  if new.status = 'published' then
    insert into public.notifications (user_id, type, title, link)
    values (v_business.owner_id, 'avis', 'Nouvel avis sur ' || v_business.name, '/mes-pages-pro/' || v_business.id);
  end if;
  return new;
end;
$$;
create trigger reviews_notify_decision after update of status on public.reviews
  for each row execute function public.notify_review_decision();

-- Consommation de l'IA : génération de présentation et de FAQ.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check check (feature in ('publication', 'profil_pro'));
