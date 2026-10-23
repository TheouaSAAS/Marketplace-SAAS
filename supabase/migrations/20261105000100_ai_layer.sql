-- =============================================================================
-- Niveau 23 : couche IA, RAG et données locales.
--
-- - base de connaissances de l'assistant étendue aux lieux, quartiers et
--   événements VÉRIFIÉS et publiés (en plus des articles du guide) ;
-- - recherche plein texte des passages (français, sans accents) : aucune
--   donnée non vérifiée n'est jamais renvoyée ;
-- - suivi de la consommation par usage, interrupteur général d'arrêt de l'IA.
-- Les vecteurs (colonne `embedding`) restent vides : aucun fournisseur
-- d'embeddings n'est configuré ; la recherche plein texte suffit au volume local.
-- =============================================================================

alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature in ('publication', 'profil_pro', 'assistant', 'recherche', 'moderation'));

-- Interrupteur général : coupe toutes les fonctions d'IA sans redéploiement.
insert into public.platform_settings (key, value, description)
values ('ai.kill_switch', '{"disabled": false}', 'Coupe toutes les fonctions d’IA (assistant, recherche, copilotes, modération).')
on conflict (key) do nothing;

-- Basculé par un administrateur, avec raison journalisée.
create or replace function public.set_ai_kill_switch(p_disabled boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old boolean;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  select coalesce((value ->> 'disabled')::boolean, false) into v_old from public.platform_settings where key = 'ai.kill_switch';
  update public.platform_settings
  set value = jsonb_build_object('disabled', p_disabled), updated_by = (select auth.uid()), updated_at = now()
  where key = 'ai.kill_switch';
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_disabled then 'ia.arret' else 'ia.reprise' end, 'platform_settings', null,
          jsonb_build_object('avant', v_old, 'apres', p_disabled, 'raison', btrim(p_reason)));
end;
$$;
revoke execute on function public.set_ai_kill_switch(boolean, text) from public, anon;

-- Consommation du mois par usage : volumes et coût, jamais de contenu.
create or replace function public.ai_usage_summary()
returns table (feature text, calls integer, input_tokens bigint, output_tokens bigint, cost_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
  select u.feature, count(*)::integer, sum(u.input_tokens)::bigint, sum(u.output_tokens)::bigint, sum(u.cost_usd)
  from public.ai_usage u
  where u.created_at >= date_trunc('month', now() at time zone 'Africa/Abidjan') at time zone 'Africa/Abidjan'
  group by u.feature
  order by u.feature;
end;
$$;
revoke execute on function public.ai_usage_summary() from public, anon;

-- -----------------------------------------------------------------------------
-- Base de connaissances
-- -----------------------------------------------------------------------------
alter table public.knowledge_chunks
  add column search_vector tsvector generated always as (to_tsvector('french', public.immutable_unaccent(content))) stored;
create index knowledge_chunks_search_idx on public.knowledge_chunks using gin (search_vector);

-- Enregistre (ou retire) un document et ses passages. Usage interne aux déclencheurs.
create or replace function public.put_knowledge(
  p_type text, p_id uuid, p_keep boolean, p_city uuid, p_title text, p_content text, p_url text,
  p_status public.verification_status, p_verified_at timestamptz, p_source uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_document uuid;
  v_hash text := md5(coalesce(p_content, ''));
begin
  if not p_keep then
    delete from public.knowledge_documents where entity_type = p_type and entity_id = p_id;
    return;
  end if;
  if exists (select 1 from public.knowledge_documents where entity_type = p_type and entity_id = p_id and content_hash = v_hash
             and verification_status = p_status and verified_at is not distinct from p_verified_at
             and source_id is not distinct from p_source and url_path is not distinct from p_url) then
    return;
  end if;
  insert into public.knowledge_documents (entity_type, entity_id, city_id, title, content, url_path, verification_status, verified_at, source_id, content_hash, updated_at)
  values (p_type, p_id, p_city, p_title, p_content, p_url, p_status, p_verified_at, p_source, v_hash, now())
  on conflict (entity_type, entity_id) do update
    set city_id = excluded.city_id, title = excluded.title, content = excluded.content, url_path = excluded.url_path,
        verification_status = excluded.verification_status, verified_at = excluded.verified_at, source_id = excluded.source_id,
        content_hash = excluded.content_hash, updated_at = now()
  returning id into v_document;
  delete from public.knowledge_chunks where document_id = v_document;
  insert into public.knowledge_chunks (document_id, chunk_index, content, token_count)
  select v_document, ordinality - 1, chunk, ceil(char_length(chunk) / 4.0)::integer
  from public.chunk_text(p_content) with ordinality as t(chunk, ordinality);
end;
$$;
revoke execute on function public.put_knowledge(text, uuid, boolean, uuid, text, text, text, public.verification_status, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.sync_place_knowledge()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_category text;
  v_neighborhood text;
begin
  if tg_op = 'DELETE' then
    perform public.put_knowledge('place', old.id, false, null, null, null, null, null, null, null);
    return old;
  end if;
  select name into v_category from public.categories where id = new.category_id;
  select name into v_neighborhood from public.neighborhoods where id = new.neighborhood_id;
  perform public.put_knowledge(
    'place', new.id,
    new.status = 'published' and new.verification_status = 'verified' and new.merged_into is null,
    new.city_id, new.name,
    concat_ws(E'\n\n', new.name || coalesce(' (' || v_category || ')', ''),
      new.summary, new.description,
      case when v_neighborhood is not null then 'Quartier : ' || v_neighborhood end,
      case when new.address_text is not null then 'Adresse : ' || new.address_text end,
      case when array_length(new.features, 1) > 0 then 'Services : ' || array_to_string(new.features, ', ') end,
      case when new.access_conditions is not null then 'Accès : ' || new.access_conditions end,
      case when new.warnings is not null then 'À savoir : ' || new.warnings end),
    '/lieux/' || new.slug, new.verification_status, new.verified_at, new.source_id);
  return new;
end;
$$;
create trigger places_knowledge after insert or update or delete on public.places
  for each row execute function public.sync_place_knowledge();

create or replace function public.sync_neighborhood_knowledge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.put_knowledge('neighborhood', old.id, false, null, null, null, null, null, null, null);
    return old;
  end if;
  perform public.put_knowledge(
    'neighborhood', new.id,
    new.is_active and new.verification_status = 'verified' and coalesce(btrim(new.description), '') <> '',
    new.city_id, 'Quartier ' || new.name,
    concat_ws(E'\n\n', 'Quartier ' || new.name,
      case when array_length(new.alt_names, 1) > 0 then 'Autres noms : ' || array_to_string(new.alt_names, ', ') end,
      new.description),
    '/quartiers/' || new.slug, new.verification_status, new.verified_at, new.source_id);
  return new;
end;
$$;
create trigger neighborhoods_knowledge after insert or update or delete on public.neighborhoods
  for each row execute function public.sync_neighborhood_knowledge();

create or replace function public.sync_event_knowledge()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform public.put_knowledge('event', old.id, false, null, null, null, null, null, null, null);
    return old;
  end if;
  perform public.put_knowledge(
    'event', new.id,
    new.status = 'published' and new.verification_status = 'verified' and new.schedule_status <> 'cancelled',
    new.city_id, new.title,
    concat_ws(E'\n\n', new.title,
      'Date : ' || to_char(new.starts_at at time zone 'Africa/Abidjan', 'DD/MM/YYYY à HH24"h"MI')
        || case when new.schedule_status = 'postponed' then ' (reporté)' else '' end,
      new.description,
      case when new.address_text is not null then 'Lieu : ' || new.address_text end,
      case when new.is_free then 'Entrée gratuite.' end),
    '/evenements/' || new.slug, new.verification_status, new.verified_at, new.source_id);
  return new;
end;
$$;
create trigger events_knowledge after insert or update or delete on public.events
  for each row execute function public.sync_event_knowledge();

-- Les événements passés sortent de la base de connaissances (tâche quotidienne).
create or replace function public.purge_past_event_knowledge()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.knowledge_documents d
  using public.events e
  where d.entity_type = 'event' and d.entity_id = e.id and coalesce(e.ends_at, e.starts_at) < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.purge_past_event_knowledge() from public, anon, authenticated;
select cron.schedule('purger-connaissances-evenements', '35 3 * * *', 'select public.purge_past_event_knowledge()');

-- Contenus existants.
update public.places set updated_at = updated_at where status = 'published' and verification_status = 'verified';
update public.neighborhoods set updated_at = updated_at where verification_status = 'verified';
update public.events set updated_at = updated_at where status = 'published' and verification_status = 'verified';

-- Passages pertinents pour une question : documents VÉRIFIÉS uniquement, du plus
-- au moins pertinent, avec leur source et leur date de vérification.
create or replace function public.search_knowledge(p_query text, p_limit integer default 6)
returns table (
  chunk_id uuid, document_id uuid, entity_type text, title text, url_path text, content text,
  verified_at timestamptz, source_title text, rank real
)
language sql stable security definer set search_path = '' as $$
  with words as (
    select string_agg(distinct w || ':*', ' | ') as q
    from regexp_split_to_table(lower(public.immutable_unaccent(left(coalesce(p_query, ''), 500))), '[^a-z0-9]+') as w
    where length(w) >= 3
  ),
  query as (
    select to_tsquery('french', q) as tsq from words where q is not null
  )
  select c.id, d.id, d.entity_type, d.title, d.url_path, c.content, d.verified_at, s.title,
         ts_rank_cd(c.search_vector, query.tsq)::real
  from query
  join public.knowledge_chunks c on c.search_vector @@ query.tsq
  join public.knowledge_documents d on d.id = c.document_id
  left join public.sources s on s.id = d.source_id
  where d.verification_status = 'verified' and query.tsq is not null
  order by 9 desc, d.verified_at desc nulls last
  limit least(greatest(coalesce(p_limit, 6), 1), 12)
$$;
grant execute on function public.search_knowledge(text, integer) to anon, authenticated;
