-- =============================================================================
-- Carrefour des Possibles — Sécurité
-- Migration 0002 : fonctions de rôle, règles métier en déclencheurs, RLS,
-- stockage des images.
--
-- Principe : l'interface et les actions serveur vérifient les droits pour
-- offrir de bons messages d'erreur, mais c'est ICI que les droits sont
-- garantis (§3.7 : « vérifiés côté serveur ou au niveau des règles d'accès »).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions de rôle
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER : lit profiles sans repasser par ses propres règles RLS.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('moderator', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_suspended from public.profiles where id = (select auth.uid())), false)
$$;

-- Vrai pour les opérations système : clé secrète (service_role), éditeur SQL,
-- ou fonctions SECURITY DEFINER. SECURITY INVOKER obligatoire : current_user
-- doit refléter le rôle réel qui exécute la requête.
create or replace function public.is_service_context()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin')
$$;

-- -----------------------------------------------------------------------------
-- Profils
-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  insert into public.profiles (id, display_name)
  values (new.id, case when char_length(v_name) between 2 and 80 then v_name end);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Le rôle et la suspension ne sont modifiables que par un administrateur.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.is_suspended is distinct from old.is_suspended)
     and not (public.is_admin() or public.is_service_context()) then
    raise exception 'Seul un administrateur peut modifier le rôle ou la suspension d''un compte.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- -----------------------------------------------------------------------------
-- Cycle de vie des contenus
-- Matrices identiques à src/domain/content-status.ts (vérifié par un test
-- automatique qui lit les blocs BEGIN/END ci-dessous : ne pas les renommer).
-- -----------------------------------------------------------------------------
create or replace function public.content_transition_allowed(
  p_from public.content_status,
  p_to public.content_status,
  p_is_staff boolean,
  p_is_owner boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from is distinct from p_to and (
    (p_is_staff and (p_from::text, p_to::text) in (
      -- BEGIN staff_transitions
      ('draft', 'pending'), ('draft', 'archived'),
      ('pending', 'published'), ('pending', 'rejected'), ('pending', 'archived'),
      ('published', 'rejected'), ('published', 'expired'), ('published', 'archived'),
      ('rejected', 'pending'), ('rejected', 'published'), ('rejected', 'archived'),
      ('expired', 'published'), ('expired', 'archived'),
      ('archived', 'published'), ('archived', 'draft')
      -- END staff_transitions
    ))
    or
    (p_is_owner and (p_from::text, p_to::text) in (
      -- BEGIN owner_transitions
      ('draft', 'pending'), ('draft', 'archived'),
      ('pending', 'draft'), ('pending', 'archived'),
      ('published', 'archived'),
      ('rejected', 'draft'), ('rejected', 'pending'), ('rejected', 'archived'),
      ('expired', 'pending'), ('expired', 'archived'),
      ('archived', 'draft')
      -- END owner_transitions
    ))
  )
$$;

-- Déclencheur commun aux tables listings, places, events, business_profiles.
-- TG_ARGV[0] = nom de la colonne propriétaire.
--  * création par un utilisateur : statut brouillon ou en attente uniquement ;
--  * changement de statut : selon les matrices ci-dessus ;
--  * champs réservés à la modération (vérification, dates de publication,
--    motif de rejet, compteur de vues, propriétaire) : non modifiables par
--    l'utilisateur ; ses valeurs sont silencieusement rétablies ;
--  * modification du contenu d'une publication par son auteur : retour en
--    vérification (« en attente »), pour empêcher la substitution de contenu
--    après validation.
create or replace function public.enforce_content_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_column text := tg_argv[0];
  -- Modération ou opération système (clé secrète, tâche planifiée).
  v_privileged boolean := public.is_staff() or public.is_service_context();
  v_new jsonb := to_jsonb(new);
  v_protected text[] := array['is_verified', 'verified_at', 'published_at', 'rejection_reason', 'view_count', 'expires_at'];
  v_ignored text[] := array['status', 'updated_at', 'search_vector', 'view_count'];
  v_patch jsonb;
  v_default_days integer;
begin
  if tg_op = 'INSERT' then
    if not v_privileged then
      if new.status not in ('draft', 'pending') then
        raise exception 'Un contenu ne peut être créé qu''en brouillon ou en attente de vérification.'
          using errcode = '42501';
      end if;
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
      from jsonb_each('{"is_verified": false, "verified_at": null, "published_at": null,
                        "rejection_reason": null, "view_count": 0, "expires_at": null}'::jsonb)
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);
    end if;
  else
    if not v_privileged then
      -- Propriétaire et champs de modération : valeurs d'origine rétablies.
      select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key), '{}'::jsonb) into v_patch
      from unnest(v_protected || v_owner_column) as key
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);

      if old.status = 'published' and new.status = 'published'
         and (to_jsonb(new) - v_ignored) is distinct from (to_jsonb(old) - v_ignored) then
        new.status := 'pending';
      end if;
    end if;

    if new.status is distinct from old.status
       and not public.content_transition_allowed(
         old.status,
         new.status,
         v_privileged,
         -- coalesce : sans session, auth.uid() est nul et la comparaison ne doit pas valoir NULL.
         coalesce((to_jsonb(old) ->> v_owner_column)::uuid = (select auth.uid()), false)
       )
       -- Le retour automatique en vérification ci-dessus est toujours permis.
       and not (old.status = 'published' and new.status = 'pending' and not v_privileged) then
      raise exception 'Changement de statut non autorisé (% → %).', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if v_new ? 'published_at' then
      new := jsonb_populate_record(new, jsonb_build_object('published_at', now()));
    end if;
    -- Durée de diffusion par défaut des annonces (paramètre d'administration).
    -- Une échéance absente ou déjà passée (republication après expiration) est recalculée.
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

create trigger listings_content_rules before insert or update on public.listings
  for each row execute function public.enforce_content_rules('owner_id');
create trigger places_content_rules before insert or update on public.places
  for each row execute function public.enforce_content_rules('created_by');
create trigger events_content_rules before insert or update on public.events
  for each row execute function public.enforce_content_rules('organizer_id');
create trigger business_profiles_content_rules before insert or update on public.business_profiles
  for each row execute function public.enforce_content_rules('owner_id');

-- Cohérence des références : catégorie active et adaptée au type de contenu,
-- quartier appartenant à la ville, ville active. TG_ARGV[0] = type de contenu.
create or replace function public.validate_content_references()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.content_type := tg_argv[0]::public.content_type;
  v_category_id uuid := (to_jsonb(new) ->> 'category_id')::uuid;
begin
  if not exists (select 1 from public.cities c where c.id = new.city_id and c.is_active) then
    raise exception 'Ville inconnue ou non ouverte.' using errcode = '23503';
  end if;

  if new.neighborhood_id is not null and not exists (
    select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.city_id = new.city_id
  ) then
    raise exception 'Ce quartier n''appartient pas à la ville choisie.' using errcode = '23503';
  end if;

  if v_category_id is not null and not exists (
    select 1 from public.categories k
    where k.id = v_category_id and k.is_active and v_type = any (k.content_types)
  ) then
    raise exception 'Catégorie inconnue, inactive ou inadaptée à ce type de contenu.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger listings_validate_refs before insert or update of city_id, neighborhood_id, category_id on public.listings
  for each row execute function public.validate_content_references('listing');
create trigger places_validate_refs before insert or update of city_id, neighborhood_id, category_id on public.places
  for each row execute function public.validate_content_references('place');
create trigger events_validate_refs before insert or update of city_id, neighborhood_id, category_id on public.events
  for each row execute function public.validate_content_references('event');
create trigger business_profiles_validate_refs before insert or update of city_id, neighborhood_id, category_id on public.business_profiles
  for each row execute function public.validate_content_references('business');

-- -----------------------------------------------------------------------------
-- Demandes de contact : destinataire déduit du contenu, jamais fourni par le client.
-- -----------------------------------------------------------------------------
create or replace function public.set_contact_request_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
begin
  if new.listing_id is not null then
    select owner_id into v_recipient from public.listings
    where id = new.listing_id and status = 'published' and (expires_at is null or expires_at > now());
  elsif new.place_id is not null then
    select coalesce(b.owner_id, p.created_by) into v_recipient
    from public.places p left join public.business_profiles b on b.id = p.business_id
    where p.id = new.place_id and p.status = 'published';
  elsif new.event_id is not null then
    select organizer_id into v_recipient from public.events where id = new.event_id and status = 'published';
  else
    select owner_id into v_recipient from public.business_profiles where id = new.business_id and status = 'published';
  end if;

  if v_recipient is null then
    raise exception 'Ce contenu n''est pas disponible.' using errcode = '23503';
  end if;
  if v_recipient = new.sender_id then
    raise exception 'Vous ne pouvez pas vous contacter vous-même.' using errcode = '23514';
  end if;

  new.recipient_id := v_recipient;
  new.status := 'new';
  return new;
end;
$$;

create trigger contact_requests_set_recipient
  before insert on public.contact_requests
  for each row execute function public.set_contact_request_recipient();

-- -----------------------------------------------------------------------------
-- Tâches système
-- -----------------------------------------------------------------------------
-- Expiration des annonces arrivées à échéance. À planifier (pg_cron), voir docs/DATABASE.md.
create or replace function public.expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.listings set status = 'expired'
  where status = 'published' and expires_at is not null and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.expire_listings() from public, anon, authenticated;

-- Journalisation des opérations de modération et d'administration.
create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_staff() or public.is_service_context()) then
    raise exception 'Action réservée à l''équipe.' using errcode = '42501';
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke execute on function public.log_admin_action(text, text, uuid, jsonb) from public, anon;

-- -----------------------------------------------------------------------------
-- Activation de RLS sur toutes les tables
-- -----------------------------------------------------------------------------
alter table public.cities enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.places enable row level security;
alter table public.listings enable row level security;
alter table public.events enable row level security;
alter table public.images enable row level security;
alter table public.favorites enable row level security;
alter table public.contact_requests enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.sponsored_campaigns enable row level security;
alter table public.payments enable row level security;
alter table public.platform_settings enable row level security;
alter table public.admin_audit_log enable row level security;

-- -----------------------------------------------------------------------------
-- Référentiel : lecture publique des éléments actifs, écriture administrateur
-- -----------------------------------------------------------------------------
create policy cities_select on public.cities for select using (is_active or (select public.is_staff()));
create policy cities_admin_write on public.cities for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy neighborhoods_select on public.neighborhoods for select using (is_active or (select public.is_staff()));
create policy neighborhoods_admin_write on public.neighborhoods for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy categories_select on public.categories for select using (is_active or (select public.is_staff()));
create policy categories_admin_write on public.categories for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy plans_select on public.plans for select using (is_active or (select public.is_admin()));
create policy plans_admin_write on public.plans for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy platform_settings_select on public.platform_settings for select
  using (is_public or (select public.is_admin()));
create policy platform_settings_admin_write on public.platform_settings for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Profils : chacun voit et modifie le sien ; l'équipe voit tout.
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Contenus : public = publié ; propriétaire = les siens ; équipe = tout.
-- -----------------------------------------------------------------------------
create policy listings_select on public.listings for select using (
  (status = 'published' and (expires_at is null or expires_at > now()))
  or owner_id = (select auth.uid())
  or (select public.is_staff())
);
create policy listings_insert on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and not (select public.is_suspended()));
create policy listings_update on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_staff()));
create policy listings_delete on public.listings for delete to authenticated
  using ((owner_id = (select auth.uid()) and status = 'draft') or (select public.is_admin()));

create policy places_select on public.places for select using (
  status = 'published' or created_by = (select auth.uid()) or (select public.is_staff())
);
-- Les lieux touristiques sont créés par l'équipe ; les établissements par leurs exploitants.
create policy places_insert on public.places for insert to authenticated with check (
  created_by = (select auth.uid())
  and not (select public.is_suspended())
  and (kind = 'etablissement' or (select public.is_staff()))
);
create policy places_update on public.places for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_staff()))
  with check (created_by = (select auth.uid()) or (select public.is_staff()));
create policy places_delete on public.places for delete to authenticated
  using ((created_by = (select auth.uid()) and status = 'draft') or (select public.is_admin()));

create policy events_select on public.events for select using (
  status = 'published' or organizer_id = (select auth.uid()) or (select public.is_staff())
);
create policy events_insert on public.events for insert to authenticated
  with check (organizer_id = (select auth.uid()) and not (select public.is_suspended()));
create policy events_update on public.events for update to authenticated
  using (organizer_id = (select auth.uid()) or (select public.is_staff()))
  with check (organizer_id = (select auth.uid()) or (select public.is_staff()));
create policy events_delete on public.events for delete to authenticated
  using ((organizer_id = (select auth.uid()) and status = 'draft') or (select public.is_admin()));

create policy business_profiles_select on public.business_profiles for select using (
  status = 'published' or owner_id = (select auth.uid()) or (select public.is_staff())
);
create policy business_profiles_insert on public.business_profiles for insert to authenticated
  with check (owner_id = (select auth.uid()) and not (select public.is_suspended()));
create policy business_profiles_update on public.business_profiles for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_staff()));
create policy business_profiles_delete on public.business_profiles for delete to authenticated
  using ((owner_id = (select auth.uid()) and status = 'draft') or (select public.is_admin()));

-- Images : visibles si le contenu parent l'est (les sous-requêtes appliquent la RLS du parent).
create policy images_select on public.images for select using (
  (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id))
  or (place_id is not null and exists (select 1 from public.places p where p.id = place_id))
  or (event_id is not null and exists (select 1 from public.events e where e.id = event_id))
  or (business_id is not null and exists (select 1 from public.business_profiles b where b.id = business_id))
);
create policy images_insert on public.images for insert to authenticated with check (
  owner_id = (select auth.uid())
  and split_part(storage_path, '/', 1) = (select auth.uid())::text
  and (
    (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())))
    or (place_id is not null and exists (select 1 from public.places p where p.id = place_id and p.created_by = (select auth.uid())))
    or (event_id is not null and exists (select 1 from public.events e where e.id = event_id and e.organizer_id = (select auth.uid())))
    or (business_id is not null and exists (select 1 from public.business_profiles b where b.id = business_id and b.owner_id = (select auth.uid())))
    or (select public.is_staff())
  )
);
create policy images_update on public.images for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()))
  with check (owner_id = (select auth.uid()) or (select public.is_staff()));
create policy images_delete on public.images for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()));

-- -----------------------------------------------------------------------------
-- Interactions
-- -----------------------------------------------------------------------------
create policy favorites_owner on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Visiteurs non connectés : passage obligé par une action serveur avec limitation de débit (phase 3).
create policy contact_requests_insert on public.contact_requests for insert to authenticated
  with check (sender_id = (select auth.uid()) and not (select public.is_suspended()));
create policy contact_requests_select on public.contact_requests for select to authenticated using (
  sender_id = (select auth.uid()) or recipient_id = (select auth.uid()) or (select public.is_staff())
);
create policy contact_requests_update on public.contact_requests for update to authenticated
  using (recipient_id = (select auth.uid()) or (select public.is_staff()))
  with check (recipient_id = (select auth.uid()) or (select public.is_staff()));

create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_staff()));
create policy reports_staff_update on public.reports for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- Créées par le serveur ; l'utilisateur les lit et les marque comme lues.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Monétisation : lecture de ses propres données ; écritures par le serveur
-- uniquement (clé secrète), après confirmation du prestataire de paiement.
-- -----------------------------------------------------------------------------
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
-- La charge utile brute du prestataire n'est jamais lisible par les comptes utilisateurs.
revoke select on public.payments from anon, authenticated;
grant select (id, user_id, subscription_id, campaign_id, amount_xof, currency, provider,
              provider_reference, status, confirmed_at, created_at, updated_at)
  on public.payments to authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

create policy sponsored_campaigns_select on public.sponsored_campaigns for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_staff()));
create policy sponsored_campaigns_insert on public.sponsored_campaigns for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'draft');
create policy sponsored_campaigns_update on public.sponsored_campaigns for update to authenticated
  using ((owner_id = (select auth.uid()) and status = 'draft') or (select public.is_staff()))
  with check ((owner_id = (select auth.uid()) and status in ('draft', 'pending_payment')) or (select public.is_staff()));

-- -----------------------------------------------------------------------------
-- Journal d'administration : lecture administrateur, écriture via log_admin_action().
-- -----------------------------------------------------------------------------
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Stockage des images (bucket public `media`)
-- Chemin imposé : <uid>/<uuid>.<ext> ; formats et taille limités par le bucket.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_public_read on storage.objects for select
  using (bucket_id = 'media');
create policy media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));
