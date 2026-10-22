-- =============================================================================
-- Niveau 13 : guide pratique de la ville.
-- - Rubriques reliées aux catégories du site (ressources réelles).
-- - Enregistrement d'un article avec note de modification (versions).
-- - Historique public (dates et notes, sans contenu) et crédits (auteur, source).
-- - Suggestions de correction limitées et traitées par l'équipe locale.
-- - Préparation de l'assistant : les articles publiés alimentent les documents
--   de connaissance, découpés en passages (vecteurs calculés au niveau 23).
-- =============================================================================

-- Rubriques ↔ catégories du site (administrable) : « Sur le site » sur chaque rubrique.
alter table public.guide_sections add column category_slugs text[] not null default '{}';
update public.guide_sections s set category_slugs = v.slugs::text[], description = coalesce(s.description, v.description)
from (values
  ('s-installer', '{}', 'Premières démarches, repères et contacts utiles pour s’installer.'),
  ('se-loger', '{immobilier-location,immobilier-vente}', 'Chercher un logement, comprendre les usages, éviter les arnaques.'),
  ('se-deplacer', '{transport-livraison}', 'Moyens de déplacement dans la ville et vers les environs.'),
  ('services-essentiels', '{services-professionnels}', 'Eau, électricité, administrations et services du quotidien.'),
  ('faire-ses-courses', '{alimentation,commerces-boutiques}', 'Marchés, commerces et approvisionnement.'),
  ('sante', '{sante}', 'Se soigner : structures de santé et réflexes utiles.'),
  ('banques', '{}', 'Banques, paiement mobile et gestion de l’argent au quotidien.'),
  ('telecommunications', '{telephonie-informatique}', 'Téléphone, internet et recharges.'),
  ('education', '{formation}', 'Écoles, formations et apprentissage.'),
  ('tourisme', '{lieux-a-visiter,plages-sites-naturels,hotels-hebergements,restaurants-gastronomie}', 'Découvrir San Pedro et ses environs.'),
  ('entreprendre', '{opportunites-commerciales,services-aux-entreprises}', 'Créer et développer une activité.')
) as v(slug, slugs, description)
where s.slug = v.slug;

-- -----------------------------------------------------------------------------
-- Enregistrement d'un article (équipe locale) avec note de modification
-- -----------------------------------------------------------------------------
create or replace function public.save_guide_article(
  p_id uuid,
  p_section uuid,
  p_slug text,
  p_title text,
  p_summary text,
  p_body text,
  p_status public.content_status,
  p_verification public.verification_status,
  p_source uuid,
  p_change_note text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_change_note, ''))) < 3 then
    raise exception 'Décrivez la modification (3 caractères au moins).' using errcode = '23514';
  end if;
  -- Lue par snapshot_guide_article pour la version créée.
  perform set_config('app.change_reason', btrim(p_change_note), true);
  if p_id is null then
    insert into public.guide_articles (section_id, city_id, slug, title, summary, body, author_id, status, verification_status, source_id)
    values (p_section, (select id from public.cities where is_default), p_slug, p_title, nullif(btrim(coalesce(p_summary, '')), ''), p_body,
            (select auth.uid()), p_status, p_verification, p_source)
    returning id into v_id;
  else
    update public.guide_articles
    set section_id = p_section, title = p_title, summary = nullif(btrim(coalesce(p_summary, '')), ''), body = p_body,
        status = p_status, verification_status = p_verification, source_id = p_source,
        -- Une nouvelle vérification se date à nouveau (règle enforce_guide_rules).
        verified_at = case when p_verification = 'verified' then verified_at end,
        verified_by = case when p_verification = 'verified' then verified_by end
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Article introuvable.' using errcode = '23514';
    end if;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.save_guide_article(uuid, uuid, text, text, text, text, public.content_status, public.verification_status, uuid, text) from public, anon;
grant execute on function public.save_guide_article(uuid, uuid, text, text, text, text, public.content_status, public.verification_status, uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Historique public et crédits d'un article publié
-- -----------------------------------------------------------------------------
create or replace function public.guide_article_history(p_article uuid)
returns table (version integer, created_at timestamptz, change_note text)
language sql stable security definer set search_path = '' as $$
  select v.version, v.created_at, v.change_note
  from public.guide_article_versions v
  join public.guide_articles a on a.id = v.article_id
  where v.article_id = p_article
    and ((a.status = 'published' and public.verification_publicly_visible(a.verification_status)) or public.is_curator() or public.is_staff())
  order by v.version desc
  limit 50
$$;

create or replace function public.guide_article_credits(p_article uuid)
returns table (author_name text, source_title text, source_publisher text, source_url text, source_collected_at date, verifier_name text)
language sql stable security definer set search_path = '' as $$
  select au.display_name, s.title, s.publisher, s.url, s.collected_at, ve.display_name
  from public.guide_articles a
  left join public.profiles au on au.id = a.author_id
  left join public.profiles ve on ve.id = a.verified_by
  left join public.sources s on s.id = a.source_id
  where a.id = p_article
    and ((a.status = 'published' and public.verification_publicly_visible(a.verification_status)) or public.is_curator() or public.is_staff())
$$;
revoke execute on function public.guide_article_history(uuid) from public;
revoke execute on function public.guide_article_credits(uuid) from public;
grant execute on function public.guide_article_history(uuid) to anon, authenticated;
grant execute on function public.guide_article_credits(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Suggestions de correction : 5 par jour, ouvertes à la création, réponse motivée
-- -----------------------------------------------------------------------------
alter table public.guide_suggestions
  add column resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000);

create or replace function public.enforce_guide_suggestion_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_service_request() then
    return new;
  end if;
  if not exists (select 1 from public.guide_articles a where a.id = new.article_id and a.status = 'published') then
    raise exception 'Cet article n''accepte pas de suggestion.' using errcode = '23514';
  end if;
  if (select count(*) from public.guide_suggestions where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de suggestions en peu de temps. Réessayez demain.' using errcode = 'CP429';
  end if;
  new.status := 'open';
  new.handled_by := null;
  new.resolution_note := null;
  return new;
end;
$$;
create trigger guide_suggestions_rules before insert on public.guide_suggestions
  for each row execute function public.enforce_guide_suggestion_rules();

-- Traitement : l'équipe change le statut et la réponse, jamais le message de l'auteur.
create or replace function public.protect_guide_suggestion()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if public.is_service_context() or public.is_service_request() then
    return new;
  end if;
  if new.message is distinct from old.message or new.user_id is distinct from old.user_id or new.article_id is distinct from old.article_id then
    raise exception 'Le message d''une suggestion ne se modifie pas.' using errcode = '42501';
  end if;
  new.handled_by := (select auth.uid());
  return new;
end;
$$;
create trigger guide_suggestions_protect before update on public.guide_suggestions
  for each row execute function public.protect_guide_suggestion();

-- -----------------------------------------------------------------------------
-- Préparation de l'assistant (RAG) : documents et passages des articles publiés
-- -----------------------------------------------------------------------------
-- Découpe un texte en passages d'au plus p_max caractères, aux paragraphes.
create or replace function public.chunk_text(p_text text, p_max integer default 1200)
returns setof text language plpgsql immutable set search_path = '' as $$
declare
  v_paragraph text;
  v_current text := '';
begin
  foreach v_paragraph in array regexp_split_to_array(coalesce(p_text, ''), E'\\n\\s*\\n') loop
    v_paragraph := btrim(v_paragraph);
    continue when v_paragraph = '';
    if v_current <> '' and char_length(v_current) + char_length(v_paragraph) + 2 > p_max then
      return next v_current;
      v_current := '';
    end if;
    -- Un paragraphe plus long que la limite est coupé net.
    while char_length(v_paragraph) > p_max loop
      if v_current <> '' then
        return next v_current;
        v_current := '';
      end if;
      return next left(v_paragraph, p_max);
      v_paragraph := substr(v_paragraph, p_max + 1);
    end loop;
    v_current := case when v_current = '' then v_paragraph else v_current || E'\n\n' || v_paragraph end;
  end loop;
  if v_current <> '' then
    return next v_current;
  end if;
end;
$$;

create or replace function public.sync_guide_knowledge()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_article public.guide_articles;
  v_section text;
  v_content text;
  v_document uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.knowledge_documents where entity_type = 'guide_article' and entity_id = old.id;
    return old;
  end if;
  v_article := new;
  if v_article.status <> 'published' or v_article.verification_status in ('archived', 'rejected') then
    delete from public.knowledge_documents where entity_type = 'guide_article' and entity_id = v_article.id;
    return new;
  end if;
  select slug into v_section from public.guide_sections where id = v_article.section_id;
  v_content := v_article.title || E'\n\n' || coalesce(v_article.summary || E'\n\n', '') || v_article.body;
  insert into public.knowledge_documents (entity_type, entity_id, city_id, title, content, url_path, verification_status, verified_at, source_id, content_hash, updated_at)
  values ('guide_article', v_article.id, v_article.city_id, v_article.title, v_content, '/guide/' || v_section || '/' || v_article.slug,
          v_article.verification_status, v_article.verified_at, v_article.source_id, md5(v_content), now())
  on conflict (entity_type, entity_id) do update
    set city_id = excluded.city_id, title = excluded.title, content = excluded.content, url_path = excluded.url_path,
        verification_status = excluded.verification_status, verified_at = excluded.verified_at, source_id = excluded.source_id,
        content_hash = excluded.content_hash, updated_at = now()
  returning id into v_document;
  -- Passages recalculés ; les vecteurs (niveau 23) seront recalculés pour ce document.
  delete from public.knowledge_chunks where document_id = v_document;
  insert into public.knowledge_chunks (document_id, chunk_index, content, token_count)
  select v_document, ordinality - 1, chunk, ceil(char_length(chunk) / 4.0)::integer
  from public.chunk_text(v_content) with ordinality as t(chunk, ordinality);
  return new;
end;
$$;
create trigger guide_articles_knowledge after insert or update or delete on public.guide_articles
  for each row execute function public.sync_guide_knowledge();

-- Articles déjà publiés.
update public.guide_articles set updated_at = updated_at where status = 'published';
