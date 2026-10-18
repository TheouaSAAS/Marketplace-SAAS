-- =============================================================================
-- Niveau 2 — 5/5 : domaines métier.
-- Quartiers, événements, guide, emploi, avis, messagerie, recherches,
-- préférences, consentements, appareils, parcours nouvel arrivant, RAG,
-- stockage privé.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Annonces : disponibilité déclarée et dernière confirmation
-- -----------------------------------------------------------------------------
alter table public.listings
  add column availability_status public.availability_status not null default 'unknown',
  add column available_from date,
  -- Dernière confirmation par l'annonceur que l'annonce est toujours d'actualité.
  add column last_confirmed_at timestamptz;

select public.grant_public_columns('listings',
  array['location', 'address_text', 'contact_phone', 'contact_whatsapp', 'contact_email']);

-- -----------------------------------------------------------------------------
-- Quartiers : noms alternatifs, description neutre, périmètre facultatif
-- -----------------------------------------------------------------------------
alter table public.neighborhoods
  add column alt_names text[] not null default '{}',
  add column description text check (description is null or char_length(description) <= 2000),
  -- Facultatif : un quartier peut exister sans périmètre validé.
  add column boundary extensions.geography(multipolygon, 4326);
create index neighborhoods_boundary_gix on public.neighborhoods using gist (boundary) where boundary is not null;

-- -----------------------------------------------------------------------------
-- Événements : report et annulation
-- -----------------------------------------------------------------------------
alter table public.events
  add column schedule_status public.event_schedule_status not null default 'scheduled',
  add column original_starts_at timestamptz,
  add column schedule_note text,
  add column organizer_name text;

-- Un report conserve la date initiale ; une annulation exige une explication.
create or replace function public.track_event_schedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.starts_at is distinct from old.starts_at and new.original_starts_at is null then
    new.original_starts_at := old.starts_at;
    if new.schedule_status = 'scheduled' then
      new.schedule_status := 'postponed';
    end if;
  end if;
  if new.schedule_status = 'cancelled' and coalesce(btrim(new.schedule_note), '') = '' then
    raise exception 'Indiquez la raison de l''annulation.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger events_track_schedule before update on public.events
  for each row execute function public.track_event_schedule();

-- -----------------------------------------------------------------------------
-- Guide pratique : rubriques, articles versionnés, suggestions de correction
-- -----------------------------------------------------------------------------
create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger guide_sections_updated_at before update on public.guide_sections for each row execute function public.set_updated_at();

create table public.guide_articles (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.guide_sections (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 5 and 160),
  summary text check (summary is null or char_length(summary) <= 300),
  -- Corps en Markdown restreint (rendu côté serveur, sans HTML brut).
  body text not null check (char_length(body) between 20 and 50000),
  author_id uuid references public.profiles (id) on delete set null,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  version integer not null default 1,
  verification_status public.verification_status not null default 'pending_validation',
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  source_id uuid references public.sources (id) on delete restrict,
  verification_note text,
  search_vector tsvector generated always as (
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(summary, ''))), 'B') ||
    setweight(to_tsvector('french', public.immutable_unaccent(coalesce(body, ''))), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status <> 'verified' or (verified_at is not null and verified_by is not null and source_id is not null))
);
create index guide_articles_public_idx on public.guide_articles (city_id, section_id, status);
create index guide_articles_search_gin on public.guide_articles using gin (search_vector);
create trigger guide_articles_updated_at before update on public.guide_articles for each row execute function public.set_updated_at();

create table public.guide_article_versions (
  id bigint generated always as identity primary key,
  article_id uuid not null references public.guide_articles (id) on delete cascade,
  version integer not null,
  title text not null,
  summary text,
  body text not null,
  edited_by uuid references public.profiles (id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (article_id, version)
);

-- Chaque modification du texte crée une version (l'ancienne est conservée) :
-- numéro incrémenté AVANT l'écriture, copie enregistrée APRÈS (l'article doit exister).
create or replace function public.bump_guide_article_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.title, new.summary, new.body) is distinct from (old.title, old.summary, old.body) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;
create trigger guide_articles_bump_version before update on public.guide_articles
  for each row execute function public.bump_guide_article_version();

create or replace function public.snapshot_guide_article()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.guide_article_versions (article_id, version, title, summary, body, edited_by, change_note)
    values (new.id, new.version, new.title, new.summary, new.body, (select auth.uid()), nullif(current_setting('app.change_reason', true), ''));
  end if;
  return new;
end;
$$;
create trigger guide_articles_snapshot after insert or update on public.guide_articles
  for each row execute function public.snapshot_guide_article();

create or replace function public.enforce_guide_rules()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not (public.is_curator() or public.is_service_context()) then
    raise exception 'Seule l''équipe locale rédige le guide.' using errcode = '42501';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger guide_articles_rules before insert or update on public.guide_articles
  for each row execute function public.enforce_guide_rules();
create trigger guide_articles_revisions after insert or update or delete on public.guide_articles
  for each row execute function public.record_revision();

-- Suggestion de correction par un utilisateur (traitée par l'équipe locale).
create table public.guide_suggestions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.guide_articles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 10 and 3000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger guide_suggestions_updated_at before update on public.guide_suggestions for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Emploi : candidatures (privées par défaut)
-- -----------------------------------------------------------------------------
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 20 and 5000),
  -- Fichier dans le bucket privé `private-media` (URL signée à la lecture).
  cv_path text,
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, applicant_id)
);
create index job_applications_listing_idx on public.job_applications (listing_id, status);
create trigger job_applications_updated_at before update on public.job_applications for each row execute function public.set_updated_at();

-- Une offre close, expirée ou hors emploi n'accepte pas de candidature.
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
           and l.owner_id <> new.applicant_id
      into v_ok
    from public.listings l join public.categories k on k.id = l.category_id
    where l.id = new.listing_id;
    if not coalesce(v_ok, false) then
      raise exception 'Cette offre n''accepte pas de candidature.' using errcode = '23514';
    end if;
    new.status := 'submitted';
  end if;
  return new;
end;
$$;
create trigger job_applications_validate before insert on public.job_applications
  for each row execute function public.validate_job_application();

-- -----------------------------------------------------------------------------
-- Avis (modérés), avec réponse du professionnel
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  business_id uuid references public.business_profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) between 10 and 3000),
  status public.review_status not null default 'pending',
  response_body text check (response_body is null or char_length(response_body) <= 2000),
  response_by uuid references public.profiles (id) on delete set null,
  response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(place_id, business_id) = 1)
);
create unique index reviews_one_per_place on public.reviews (author_id, place_id) where place_id is not null;
create unique index reviews_one_per_business on public.reviews (author_id, business_id) where business_id is not null;
create index reviews_target_idx on public.reviews (place_id, business_id, status);
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

-- Chaque acteur ne modifie que ses champs ; on ne note pas son propre établissement.
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
      new.status := 'pending';
      new.response_body := null; new.response_by := null; new.response_at := null;
    end if;
    return new;
  end if;

  if v_moderator then
    return new;
  end if;
  if (select auth.uid()) = old.author_id then
    -- L'auteur modifie note et texte : l'avis repasse en modération.
    new.status := 'pending';
    new.response_body := old.response_body; new.response_by := old.response_by; new.response_at := old.response_at;
    new.author_id := old.author_id; new.place_id := old.place_id; new.business_id := old.business_id;
  elsif public.can_manage_content(v_owner, v_org) then
    -- Le professionnel ne modifie que sa réponse.
    new := jsonb_populate_record(new, to_jsonb(old) - array['response_body', 'response_at', 'response_by']);
    new.response_by := (select auth.uid());
    new.response_at := now();
  else
    raise exception 'Modification non autorisée.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reviews_rules before insert or update on public.reviews
  for each row execute function public.enforce_review_rules();

-- -----------------------------------------------------------------------------
-- Messagerie interne
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  place_id uuid references public.places (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  business_id uuid references public.business_profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(listing_id, place_id, event_id, business_id) <= 1)
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = (select auth.uid())
  )
$$;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- -----------------------------------------------------------------------------
-- Recherches sauvegardées, préférences, consentements, appareils, parcours
-- -----------------------------------------------------------------------------
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  query jsonb not null check (jsonb_typeof(query) = 'object'),
  alert_frequency text not null default 'none' check (alert_frequency in ('none', 'daily', 'weekly')),
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);
create trigger saved_searches_updated_at before update on public.saved_searches for each row execute function public.set_updated_at();

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  locale text not null default 'fr',
  -- Canaux de notification acceptés, par type : {"messages": {"email": true, "push": false}, …}
  notification_channels jsonb not null default '{}'::jsonb check (jsonb_typeof(notification_channels) = 'object'),
  -- Profil déclaré à l'inscription : particulier ou professionnel.
  account_intent text not null default 'particulier' check (account_intent in ('particulier', 'professionnel')),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

-- Historique des consentements (ajout seul) : preuve de la date et de la version acceptée.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.consent_kind not null,
  granted boolean not null,
  document_version text not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, kind, created_at desc);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'web_push' check (kind in ('web_push')),
  endpoint text not null unique,
  p256dh text,
  auth_secret text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index user_devices_user_idx on public.user_devices (user_id);

create table public.newcomer_plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  plan jsonb,
  updated_at timestamptz not null default now()
);
create trigger newcomer_plans_updated_at before update on public.newcomer_plans for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Documents pour l'assistant (RAG) : uniquement des contenus administrés
-- -----------------------------------------------------------------------------
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  city_id uuid references public.cities (id) on delete cascade,
  title text not null,
  content text not null,
  -- Chemin interne cité en source (ex. /guide/se-deplacer).
  url_path text,
  verification_status public.verification_status not null,
  verified_at timestamptz,
  source_id uuid references public.sources (id) on delete set null,
  content_hash text not null,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  -- Dimension libre : dépend du modèle d'embedding retenu (niveau 23).
  embedding extensions.vector,
  embedding_model text,
  token_count integer,
  unique (document_id, chunk_index)
);

-- -----------------------------------------------------------------------------
-- Signalements : nouvelles cibles (avis, messages, articles du guide)
-- -----------------------------------------------------------------------------
alter table public.reports
  add column review_id uuid references public.reviews (id) on delete cascade,
  add column message_id uuid references public.messages (id) on delete cascade,
  add column article_id uuid references public.guide_articles (id) on delete cascade;
alter table public.reports drop constraint reports_check;
alter table public.reports add constraint reports_single_target
  check (num_nonnulls(listing_id, place_id, event_id, business_id, review_id, message_id, article_id) = 1);

-- -----------------------------------------------------------------------------
-- Stockage privé (CV, pièces importées, brouillons) : lecture par URL signée
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-media', 'private-media', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy private_media_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'private-media' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));
create policy private_media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'private-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy private_media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.guide_sections enable row level security;
alter table public.guide_articles enable row level security;
alter table public.guide_article_versions enable row level security;
alter table public.guide_suggestions enable row level security;
alter table public.job_applications enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.saved_searches enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.user_devices enable row level security;
alter table public.newcomer_plans enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy guide_sections_select on public.guide_sections for select using (is_active or (select public.is_curator()));
create policy guide_sections_write on public.guide_sections for all to authenticated
  using ((select public.is_curator())) with check ((select public.is_curator()));

create policy guide_articles_select on public.guide_articles for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or (select public.is_curator()) or (select public.is_staff())
);
create policy guide_articles_write on public.guide_articles for all to authenticated
  using ((select public.is_curator())) with check ((select public.is_curator()));

create policy guide_article_versions_select on public.guide_article_versions for select to authenticated
  using ((select public.is_curator()) or (select public.is_staff()));

create policy guide_suggestions_insert on public.guide_suggestions for insert to authenticated
  with check (user_id = (select auth.uid()) and not (select public.is_suspended()));
create policy guide_suggestions_select on public.guide_suggestions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_curator()));
create policy guide_suggestions_update on public.guide_suggestions for update to authenticated
  using ((select public.is_curator())) with check ((select public.is_curator()));

-- Candidatures : le candidat et l'employeur (auteur ou organisation) uniquement.
create policy job_applications_select on public.job_applications for select to authenticated using (
  applicant_id = (select auth.uid())
  or exists (select 1 from public.listings l where l.id = listing_id and public.can_manage_content(l.owner_id, l.organization_id))
  or (select public.is_staff())
);
create policy job_applications_insert on public.job_applications for insert to authenticated
  with check (applicant_id = (select auth.uid()) and not (select public.is_suspended()));
create policy job_applications_update on public.job_applications for update to authenticated using (
  applicant_id = (select auth.uid())
  or exists (select 1 from public.listings l where l.id = listing_id and public.can_manage_content(l.owner_id, l.organization_id))
) with check (
  (applicant_id = (select auth.uid()) and status = 'withdrawn')
  or exists (select 1 from public.listings l where l.id = listing_id and public.can_manage_content(l.owner_id, l.organization_id))
);

create policy reviews_select on public.reviews for select using (
  status = 'published' or author_id = (select auth.uid()) or (select public.is_staff())
);
create policy reviews_insert on public.reviews for insert to authenticated
  with check (author_id = (select auth.uid()) and not (select public.is_suspended()));
-- Auteur, professionnel concerné (réponse) ou modération ; le déclencheur limite les champs de chacun.
create policy reviews_update on public.reviews for update to authenticated using (
  author_id = (select auth.uid())
  or (select public.is_staff())
  or exists (
    select 1 from public.places p left join public.business_profiles b on b.id = p.business_id
    where p.id = place_id and public.can_manage_content(coalesce(b.owner_id, p.created_by), p.organization_id)
  )
  or exists (
    select 1 from public.business_profiles b
    where b.id = business_id and public.can_manage_content(b.owner_id, b.organization_id)
  )
) with check (true);
create policy reviews_delete on public.reviews for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_staff()));

-- Conversations : uniquement les participants. Création et ajout des
-- participants par fonction serveur (niveau 8), jamais directement.
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) or (select public.is_staff()));
create policy conversation_participants_select on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy conversation_participants_update on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) or (select public.is_staff()));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_conversation_participant(conversation_id) and not (select public.is_suspended()));
create policy messages_update on public.messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));

create policy saved_searches_owner on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_preferences_owner on public.user_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));
revoke update, delete on public.consents from anon, authenticated;
create policy user_devices_owner on public.user_devices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy newcomer_plans_owner on public.newcomer_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- L'assistant ne lit que des contenus vérifiés ; écriture par le serveur uniquement.
create policy knowledge_documents_select on public.knowledge_documents for select
  using (verification_status = 'verified' or (select public.is_curator()));
create policy knowledge_chunks_select on public.knowledge_chunks for select using (
  exists (select 1 from public.knowledge_documents d where d.id = document_id and d.verification_status = 'verified')
  or (select public.is_curator())
);
revoke insert, update, delete on public.knowledge_documents, public.knowledge_chunks from anon, authenticated;

-- Rubriques initiales du guide (structure, sans contenu).
insert into public.guide_sections (slug, name, icon, sort_order) values
  ('s-installer', 'S’installer', 'house', 10),
  ('se-loger', 'Se loger', 'key-round', 20),
  ('se-deplacer', 'Se déplacer', 'bus', 30),
  ('services-essentiels', 'Services essentiels', 'landmark', 40),
  ('faire-ses-courses', 'Faire ses courses', 'shopping-basket', 50),
  ('sante', 'Santé', 'heart-pulse', 60),
  ('banques', 'Banques et argent', 'wallet', 70),
  ('telecommunications', 'Télécommunications', 'smartphone', 80),
  ('education', 'Éducation', 'graduation-cap', 90),
  ('tourisme', 'Tourisme', 'compass', 100),
  ('entreprendre', 'Entreprendre', 'briefcase', 110)
on conflict (slug) do nothing;
