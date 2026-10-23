-- =============================================================================
-- Niveau 22 : administration et back-office.
--
-- - journal automatique des changements de rôle et de suspension (comptes,
--   organisations), avec auteur, date, raison, avant et après ;
-- - historique (content_revisions) étendu aux avis, commentaires, campagnes,
--   revendications et demandes de vérification ;
-- - comptes : recherche et sanction par les administrateurs (rôles protégés
--   par protect_profile_privileges : un modérateur n'a aucun de ces droits) ;
-- - signalements : file de l'équipe de modération, suspension immédiate du
--   contenu visé (retour en « refusé » avec motif, ou masquage) ;
-- - tableau de bord : volumes des files, qualité des données (expirées, sans
--   source, à revalider, signalées) ;
-- - doublons de lieux : détection et fusion tracée (éditeurs locaux) ;
-- - mises en avant : arrêt ou refus d'une campagne (jamais d'activation sans
--   paiement confirmé).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Journal des actions sensibles sur les comptes et les organisations
-- -----------------------------------------------------------------------------
create or replace function public.audit_account_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_kind text := case when tg_table_name = 'profiles' then 'compte' else 'organisation' end;
begin
  -- IF imbriqués : « new.role » n'existe pas pour une organisation.
  if tg_table_name = 'profiles' then
    if new.role is distinct from old.role then
      insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
      values ((select auth.uid()), 'compte.role', tg_table_name, new.id,
              jsonb_build_object('avant', old.role, 'apres', new.role, 'raison', v_reason));
    end if;
  end if;
  if new.is_suspended is distinct from old.is_suspended then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), v_kind || case when new.is_suspended then '.suspension' else '.reactivation' end, tg_table_name, new.id,
            jsonb_build_object('avant', old.is_suspended, 'apres', new.is_suspended, 'raison', v_reason));
  end if;
  return new;
end;
$$;

create trigger profiles_audit after update of role, is_suspended on public.profiles
  for each row execute function public.audit_account_change();
create trigger organizations_audit after update of is_suspended on public.organizations
  for each row execute function public.audit_account_change();

-- Historique complet des décisions éditoriales restantes.
create trigger reviews_revisions after insert or update or delete on public.reviews
  for each row execute function public.record_revision();
create trigger listing_comments_revisions after insert or update or delete on public.listing_comments
  for each row execute function public.record_revision();
create trigger sponsored_campaigns_revisions after insert or update or delete on public.sponsored_campaigns
  for each row execute function public.record_revision();
create trigger place_claims_revisions after insert or update or delete on public.place_claims
  for each row execute function public.record_revision();
create trigger business_verification_requests_revisions after insert or update or delete on public.business_verification_requests
  for each row execute function public.record_revision();
create trigger reports_revisions after update on public.reports
  for each row execute function public.record_revision();

-- Délai au-delà duquel une donnée vérifiée doit être revalidée.
insert into public.platform_settings (key, value, description)
values ('verification.revalidate_months', '{"months": 12}', 'Ancienneté (mois) au-delà de laquelle une donnée vérifiée est à revalider.')
on conflict (key) do nothing;

create or replace function public.revalidation_threshold()
returns timestamptz language sql stable security definer set search_path = '' as $$
  select now() - make_interval(months => coalesce(
    (select (value ->> 'months')::integer from public.platform_settings where key = 'verification.revalidate_months'), 12))
$$;

-- -----------------------------------------------------------------------------
-- Comptes : recherche et sanctions (administrateurs)
-- -----------------------------------------------------------------------------
create or replace function public.admin_accounts(p_query text default null, p_role public.user_role default null, p_suspended boolean default null)
returns table (
  id uuid, display_name text, email text, role public.user_role, is_suspended boolean,
  created_at timestamptz, last_sign_in_at timestamptz, listings integer, organizations integer, reports_against integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, u.email::text, p.role, p.is_suspended, p.created_at, u.last_sign_in_at,
    (select count(*)::integer from public.listings l where l.owner_id = p.id),
    (select count(*)::integer from public.organization_members m where m.user_id = p.id),
    (select count(*)::integer from public.reports r
      left join public.listings l on l.id = r.listing_id
      left join public.events e on e.id = r.event_id
      left join public.business_profiles b on b.id = r.business_id
      left join public.listing_comments c on c.id = r.comment_id
      left join public.reviews v on v.id = r.review_id
      left join public.messages g on g.id = r.message_id
      where p.id in (l.owner_id, e.organizer_id, b.owner_id, c.author_id, v.author_id, g.sender_id))
  from public.profiles p
  join auth.users u on u.id = p.id
  where (v_query is null
      or p.id::text = v_query
      or u.email ilike '%' || v_query || '%'
      or p.display_name ilike '%' || v_query || '%')
    and (p_role is null or p.role = p_role)
    and (p_suspended is null or p.is_suspended = p_suspended)
  order by p.created_at desc
  limit 50;
end;
$$;
revoke execute on function public.admin_accounts(text, public.user_role, boolean) from public, anon;

-- Exécutée avec les droits de l'appelant : protect_profile_privileges s'applique
-- (rôles d'administration réservés au superadministrateur).
create or replace function public.admin_set_account(p_user uuid, p_role public.user_role, p_suspended boolean, p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Vous ne pouvez pas modifier votre propre compte.' using errcode = '42501';
  end if;
  perform set_config('app.change_reason', btrim(p_reason), true);
  update public.profiles
  set role = coalesce(p_role, role), is_suspended = coalesce(p_suspended, is_suspended)
  where id = p_user;
  if not found then
    raise exception 'Compte introuvable.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_set_account(uuid, public.user_role, boolean, text) from public, anon;

create or replace function public.admin_set_organization(p_organization uuid, p_suspended boolean, p_reason text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  perform set_config('app.change_reason', btrim(p_reason), true);
  update public.organizations set is_suspended = p_suspended where id = p_organization;
  if not found then
    raise exception 'Organisation introuvable.' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_set_organization(uuid, boolean, text) from public, anon;

create or replace function public.admin_organizations(p_query text default null)
returns table (id uuid, name text, slug text, kind public.organization_kind, is_suspended boolean, created_at timestamptz, members integer, pages integer, listings integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
  select o.id, o.name, o.slug, o.kind, o.is_suspended, o.created_at,
    (select count(*)::integer from public.organization_members m where m.organization_id = o.id),
    (select count(*)::integer from public.business_profiles b where b.organization_id = o.id),
    (select count(*)::integer from public.listings l where l.organization_id = o.id)
  from public.organizations o
  where v_query is null or o.name ilike '%' || v_query || '%' or o.slug ilike '%' || v_query || '%'
  order by o.created_at desc
  limit 50;
end;
$$;
revoke execute on function public.admin_organizations(text) from public, anon;

-- -----------------------------------------------------------------------------
-- Signalements
-- -----------------------------------------------------------------------------
create or replace function public.admin_reports(p_open boolean default true)
returns table (
  id uuid, reason public.report_reason, details text, status public.report_status, created_at timestamptz,
  handled_at timestamptz, resolution_note text, target_type text, target_id uuid, target_title text,
  target_slug text, target_parent_type text, target_parent_slug text, target_status text, target_owner uuid, target_reports integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe de modération.' using errcode = '42501';
  end if;
  return query
  with base as (
    select r.*,
      case
        when r.listing_id is not null then 'listing' when r.place_id is not null then 'place'
        when r.event_id is not null then 'event' when r.business_id is not null then 'business'
        when r.comment_id is not null then 'comment' when r.review_id is not null then 'review'
        when r.article_id is not null then 'article' else 'message'
      end as t_type,
      coalesce(r.listing_id, r.place_id, r.event_id, r.business_id, r.comment_id, r.review_id, r.article_id, r.message_id) as t_id
    from public.reports r
    where (p_open and r.status in ('open', 'reviewing')) or (not p_open and r.status in ('resolved', 'dismissed'))
  )
  select b.id, b.reason, b.details, b.status, b.created_at, b.handled_at, b.resolution_note, b.t_type, b.t_id,
    coalesce(l.title, pl.name, e.title, bp.name, left(c.body, 140), left(v.body, 140), a.title, left(g.body, 140), '(contenu supprimé)'),
    coalesce(l.slug, pl.slug, e.slug, bp.slug, a.slug),
    case when c.id is not null then 'listing' when v.place_id is not null then 'place' when v.business_id is not null then 'business'
         when a.id is not null then 'guide_section' end,
    coalesce(cl.slug, vp.slug, vb.slug, gs.slug),
    coalesce(l.status::text, pl.status::text, e.status::text, bp.status::text, c.status::text, v.status::text, a.status::text,
             case when g.deleted_at is not null then 'deleted' when g.id is not null then 'visible' end),
    coalesce(l.owner_id, pl.manager_id, pl.created_by, e.organizer_id, bp.owner_id, c.author_id, v.author_id, a.author_id, g.sender_id),
    (select count(*)::integer from public.reports o
      where o.status in ('open', 'reviewing')
        and coalesce(o.listing_id, o.place_id, o.event_id, o.business_id, o.comment_id, o.review_id, o.article_id, o.message_id) = b.t_id)
  from base b
  left join public.listings l on l.id = b.listing_id
  left join public.places pl on pl.id = b.place_id
  left join public.events e on e.id = b.event_id
  left join public.business_profiles bp on bp.id = b.business_id
  left join public.listing_comments c on c.id = b.comment_id
  left join public.listings cl on cl.id = c.listing_id
  left join public.reviews v on v.id = b.review_id
  left join public.places vp on vp.id = v.place_id
  left join public.business_profiles vb on vb.id = v.business_id
  left join public.guide_articles a on a.id = b.article_id
  left join public.guide_sections gs on gs.id = a.section_id
  left join public.messages g on g.id = b.message_id
  order by b.created_at desc
  limit 100;
end;
$$;
revoke execute on function public.admin_reports(boolean) from public, anon;

-- Décision sur un signalement. « suspendre » retire aussitôt le contenu visé
-- (annonce, lieu, événement, page pro : refusé avec motif, l'auteur est notifié
-- et peut corriger puis resoumettre ; commentaire et avis : masqués) et clôt
-- tous les signalements ouverts sur ce contenu.
create or replace function public.handle_report(p_report uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_report public.reports;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_target uuid;
  v_status public.report_status;
begin
  if not public.is_staff() then
    raise exception 'Réservé à l''équipe de modération.' using errcode = '42501';
  end if;
  if p_decision not in ('examen', 'sans_suite', 'resolu', 'suspendre') then
    raise exception 'Décision inconnue.' using errcode = '22023';
  end if;
  if p_decision in ('sans_suite', 'suspendre') and char_length(coalesce(v_note, '')) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  select * into v_report from public.reports where id = p_report for update;
  if v_report.id is null then
    raise exception 'Signalement introuvable.' using errcode = 'P0002';
  end if;
  v_target := coalesce(v_report.listing_id, v_report.place_id, v_report.event_id, v_report.business_id,
                       v_report.comment_id, v_report.review_id, v_report.article_id, v_report.message_id);
  perform set_config('app.change_reason', coalesce(v_note, 'Signalement : ' || p_decision), true);

  if p_decision = 'suspendre' then
    if v_report.listing_id is not null then
      update public.listings set status = 'rejected', rejection_reason = 'Suspendue après signalement : ' || v_note
      where id = v_report.listing_id and status <> 'rejected';
    elsif v_report.place_id is not null then
      update public.places set status = 'rejected', rejection_reason = 'Suspendu après signalement : ' || v_note
      where id = v_report.place_id and status <> 'rejected';
    elsif v_report.event_id is not null then
      update public.events set status = 'rejected', rejection_reason = 'Suspendu après signalement : ' || v_note
      where id = v_report.event_id and status <> 'rejected';
    elsif v_report.business_id is not null then
      update public.business_profiles set status = 'rejected', rejection_reason = 'Suspendue après signalement : ' || v_note
      where id = v_report.business_id and status <> 'rejected';
    elsif v_report.comment_id is not null then
      update public.listing_comments set status = 'hidden', hidden_reason = left(v_note, 300)
      where id = v_report.comment_id and status = 'visible';
    elsif v_report.review_id is not null then
      update public.reviews set status = 'hidden' where id = v_report.review_id and status <> 'hidden';
    else
      raise exception 'Ce contenu ne se suspend pas d''ici : article du guide (rédaction) ou message (suspendre le compte).'
        using errcode = '22023';
    end if;
  end if;

  v_status := case p_decision when 'examen' then 'reviewing' when 'sans_suite' then 'dismissed' else 'resolved' end;
  update public.reports
  set status = v_status, handled_by = (select auth.uid()), handled_at = now(), resolution_note = v_note
  where id = p_report
     or (p_decision = 'suspendre' and status in ('open', 'reviewing')
         and coalesce(listing_id, place_id, event_id, business_id, comment_id, review_id, article_id, message_id) = v_target);

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'signalement.' || p_decision, 'reports', p_report,
          jsonb_build_object('avant', v_report.status, 'apres', v_status, 'raison', v_note, 'contenu', v_target));
end;
$$;
revoke execute on function public.handle_report(uuid, text, text) from public, anon;

-- -----------------------------------------------------------------------------
-- Tableau de bord : volumes des files et qualité des données
-- -----------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_jobs text[] := array['emploi', 'opportunite', 'appel_offres'];
  v_threshold timestamptz := public.revalidation_threshold();
begin
  if not (public.is_staff() or public.is_curator()) then
    raise exception 'Réservé à l''équipe.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'listings', (select count(*) from public.listings l where l.status = 'pending' and coalesce(public.listing_schema(l.category_id), '') <> all (v_jobs)),
    'jobs', (select count(*) from public.listings l where l.status = 'pending' and public.listing_schema(l.category_id) = any (v_jobs)),
    'businesses', (select count(*) from public.business_profiles where status = 'pending'),
    'verifications', (select count(*) from public.business_verification_requests where status = 'pending'),
    'events', (select count(*) from public.events where status = 'pending'),
    'reviews', (select count(*) from public.reviews where status = 'pending'),
    'claims', (select count(*) from public.place_claims where status = 'pending'),
    'reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'guide_suggestions', (select count(*) from public.guide_suggestions where status in ('open', 'reviewing')),
    'boundaries', (select count(*) from public.neighborhood_boundaries where status = 'draft'),
    'ai_assisted', (select count(distinct l.id) from public.listings l join public.listing_suggestions s on s.listing_id = l.id
                    where l.status = 'pending' and s.origin = 'ia' and s.status = 'acceptee'),
    'expired', (select count(*) from public.listings where status = 'expired'
                  or (status = 'published' and expires_at is not null and expires_at <= now())),
    'without_source', (select (select count(*) from public.places where status = 'published' and source_id is null)
                            + (select count(*) from public.events where status = 'published' and source_id is null)),
    'to_revalidate', (select (select count(*) from public.places where verification_status = 'verified' and verified_at < v_threshold)
                           + (select count(*) from public.business_profiles where verification_status = 'verified' and verified_at < v_threshold)
                           + (select count(*) from public.events where verification_status = 'verified' and verified_at < v_threshold and starts_at > now())
                           + (select count(*) from public.neighborhoods where verification_status = 'verified' and verified_at < v_threshold)),
    'reported', (select count(distinct coalesce(listing_id, place_id, event_id, business_id, comment_id, review_id, article_id, message_id))
                 from public.reports where status in ('open', 'reviewing'))
  );
end;
$$;
revoke execute on function public.admin_overview() from public, anon;

create or replace function public.quality_items(p_kind text)
returns table (entity_type text, entity_id uuid, title text, slug text, status text, verification_status text, since timestamptz, detail text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_threshold timestamptz := public.revalidation_threshold();
begin
  if not (public.is_staff() or public.is_curator()) then
    raise exception 'Réservé à l''équipe.' using errcode = '42501';
  end if;
  if p_kind = 'expirees' then
    return query
    select 'listing', l.id, l.title, l.slug, l.status::text, l.verification_status::text, l.expires_at, null::text
    from public.listings l
    where l.status = 'expired' or (l.status = 'published' and l.expires_at is not null and l.expires_at <= now())
    order by l.expires_at desc nulls last limit 100;
  elsif p_kind = 'sans_source' then
    return query
    select * from (
      select 'place'::text, p.id, p.name, p.slug, p.status::text, p.verification_status::text, p.updated_at, null::text
      from public.places p where p.status = 'published' and p.source_id is null
      union all
      select 'event', e.id, e.title, e.slug, e.status::text, e.verification_status::text, e.updated_at, null
      from public.events e where e.status = 'published' and e.source_id is null
    ) t order by 7 limit 100;
  elsif p_kind = 'a_revalider' then
    return query
    select * from (
      select 'place'::text, p.id, p.name, p.slug, p.status::text, p.verification_status::text, p.verified_at, s.title
      from public.places p left join public.sources s on s.id = p.source_id
      where p.verification_status = 'verified' and p.verified_at < v_threshold
      union all
      select 'business', b.id, b.name, b.slug, b.status::text, b.verification_status::text, b.verified_at, s.title
      from public.business_profiles b left join public.sources s on s.id = b.source_id
      where b.verification_status = 'verified' and b.verified_at < v_threshold
      union all
      select 'event', e.id, e.title, e.slug, e.status::text, e.verification_status::text, e.verified_at, s.title
      from public.events e left join public.sources s on s.id = e.source_id
      where e.verification_status = 'verified' and e.verified_at < v_threshold and e.starts_at > now()
      union all
      select 'neighborhood', n.id, n.name, n.slug, null, n.verification_status::text, n.verified_at, s.title
      from public.neighborhoods n left join public.sources s on s.id = n.source_id
      where n.verification_status = 'verified' and n.verified_at < v_threshold
    ) t order by 7 limit 100;
  elsif p_kind = 'signales' then
    -- Les signalements relèvent de l'équipe de modération.
    if public.is_staff() then
      return query
      select r.target_type, r.target_id, r.target_title, r.target_slug, r.target_status, null::text, min(r.created_at), count(*)::text
      from public.admin_reports(true) r
      group by 1, 2, 3, 4, 5
      order by count(*) desc, min(r.created_at) limit 100;
    end if;
  else
    raise exception 'Catégorie inconnue.' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.quality_items(text) from public, anon;

-- -----------------------------------------------------------------------------
-- Journal et historique
-- -----------------------------------------------------------------------------
create or replace function public.admin_audit_entries(p_action text default null, p_limit integer default 100)
returns table (id bigint, created_at timestamptz, actor_id uuid, actor_name text, action text, entity_type text, entity_id uuid, details jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
  select a.id, a.created_at, a.actor_id, p.display_name, a.action, a.entity_type, a.entity_id, a.details
  from public.admin_audit_log a left join public.profiles p on p.id = a.actor_id
  where p_action is null or a.action like p_action || '%'
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;
revoke execute on function public.admin_audit_entries(text, integer) from public, anon;

create or replace function public.admin_revisions(p_entity_type text default null, p_entity_id uuid default null, p_limit integer default 50)
returns table (id bigint, changed_at timestamptz, changed_by uuid, author_name text, entity_type text, entity_id uuid, action public.revision_action, reason text, before jsonb, after jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_staff() or public.is_curator()) then
    raise exception 'Réservé à l''équipe.' using errcode = '42501';
  end if;
  return query
  select r.id, r.changed_at, r.changed_by, p.display_name, r.entity_type, r.entity_id, r.action, r.reason, r.before, r.after
  from public.content_revisions r left join public.profiles p on p.id = r.changed_by
  where (p_entity_type is null or r.entity_type = p_entity_type)
    and (p_entity_id is null or r.entity_id = p_entity_id)
  order by r.changed_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;
revoke execute on function public.admin_revisions(text, uuid, integer) from public, anon;

-- -----------------------------------------------------------------------------
-- Doublons de lieux : détection et fusion (éditeurs locaux)
-- -----------------------------------------------------------------------------
alter table public.places add column merged_into uuid references public.places (id) on delete set null;
create index places_name_trgm_idx on public.places using gin (name extensions.gin_trgm_ops);

create or replace function public.place_duplicates()
returns table (a_id uuid, a_name text, a_slug text, a_status text, b_id uuid, b_name text, b_slug text, b_status text, similarity real, distance_m integer, same_phone boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_curator() then
    raise exception 'Réservé aux éditeurs locaux.' using errcode = '42501';
  end if;
  return query
  select a.id, a.name, a.slug, a.status::text, b.id, b.name, b.slug, b.status::text,
    extensions.similarity(public.immutable_unaccent(lower(a.name)), public.immutable_unaccent(lower(b.name))),
    case when a.location is not null and b.location is not null then extensions.st_distance(a.location, b.location)::integer end,
    coalesce(regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(b.phone, '\D', '', 'g') and a.phone <> '', false)
  from public.places a
  join public.places b on b.id > a.id and b.kind = a.kind
  where a.status not in ('archived', 'rejected') and b.status not in ('archived', 'rejected')
    and a.merged_into is null and b.merged_into is null
    and (
      (extensions.similarity(public.immutable_unaccent(lower(a.name)), public.immutable_unaccent(lower(b.name))) >= 0.5
        and (a.location is null or b.location is null or extensions.st_dwithin(a.location, b.location, 300)))
      or (a.phone is not null and b.phone is not null and length(regexp_replace(a.phone, '\D', '', 'g')) >= 8
        and regexp_replace(a.phone, '\D', '', 'g') = regexp_replace(b.phone, '\D', '', 'g'))
    )
  order by 9 desc
  limit 50;
end;
$$;
revoke execute on function public.place_duplicates() from public, anon;

-- Le doublon est archivé (jamais supprimé) et pointe vers la fiche conservée ;
-- favoris, « j'aime », avis, événements et signalements sont rattachés à celle-ci.
create or replace function public.merge_places(p_keep uuid, p_duplicate uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_keep public.places;
  v_dup public.places;
  v_moved jsonb;
  n_fav integer; n_like integer; n_review integer; n_event integer; n_report integer;
begin
  if not public.is_curator() then
    raise exception 'Réservé aux éditeurs locaux.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la fusion (5 caractères au moins).' using errcode = '23514';
  end if;
  if p_keep = p_duplicate then
    raise exception 'Choisissez deux fiches différentes.' using errcode = '22023';
  end if;
  select * into v_keep from public.places where id = p_keep for update;
  select * into v_dup from public.places where id = p_duplicate for update;
  if v_keep.id is null or v_dup.id is null then
    raise exception 'Fiche introuvable.' using errcode = 'P0002';
  end if;
  if v_dup.merged_into is not null or v_keep.merged_into is not null then
    raise exception 'L''une des fiches a déjà été fusionnée.' using errcode = '23514';
  end if;
  perform set_config('app.change_reason', 'Fusion de doublons : ' || btrim(p_reason), true);

  update public.favorites f set place_id = p_keep
  where f.place_id = p_duplicate and not exists (select 1 from public.favorites k where k.place_id = p_keep and k.user_id = f.user_id);
  get diagnostics n_fav = row_count;
  delete from public.favorites where place_id = p_duplicate;

  insert into public.place_likes (place_id, user_id, created_at)
  select p_keep, user_id, created_at from public.place_likes where place_id = p_duplicate
  on conflict do nothing;
  get diagnostics n_like = row_count;
  delete from public.place_likes where place_id = p_duplicate;

  update public.reviews r set place_id = p_keep
  where r.place_id = p_duplicate and not exists (select 1 from public.reviews k where k.place_id = p_keep and k.author_id = r.author_id);
  get diagnostics n_review = row_count;

  update public.events set place_id = p_keep where place_id = p_duplicate;
  get diagnostics n_event = row_count;

  update public.reports set status = 'resolved', handled_by = (select auth.uid()), handled_at = now(),
    resolution_note = 'Doublon fusionné avec « ' || v_keep.name || ' ».'
  where place_id = p_duplicate and status in ('open', 'reviewing');
  get diagnostics n_report = row_count;

  update public.places
  set status = 'archived', merged_into = p_keep,
      verification_note = left('Doublon fusionné avec « ' || v_keep.name || ' » : ' || btrim(p_reason), 1000)
  where id = p_duplicate;

  v_moved := jsonb_build_object('favoris', n_fav, 'jaime', n_like, 'avis', n_review, 'evenements', n_event, 'signalements', n_report);
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'lieu.fusion', 'places', p_keep,
          jsonb_build_object('doublon', p_duplicate, 'doublon_nom', v_dup.name, 'raison', btrim(p_reason), 'transferts', v_moved,
                             'avant', jsonb_build_object('statut', v_dup.status), 'apres', jsonb_build_object('statut', 'archived', 'fusionne_dans', p_keep)));
  return v_moved;
end;
$$;
revoke execute on function public.merge_places(uuid, uuid, text) from public, anon;

-- -----------------------------------------------------------------------------
-- Mises en avant : arrêt ou refus d'une campagne (aucune activation sans paiement)
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_campaign_status(p_campaign uuid, p_status public.campaign_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old public.campaign_status;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if p_status not in ('paused', 'ended', 'rejected') then
    raise exception 'Une campagne ne s''active qu''après paiement confirmé : seuls la pause, l''arrêt et le refus sont possibles ici.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la décision (5 caractères au moins).' using errcode = '23514';
  end if;
  select status into v_old from public.sponsored_campaigns where id = p_campaign for update;
  if v_old is null then
    raise exception 'Campagne introuvable.' using errcode = 'P0002';
  end if;
  if v_old in ('ended', 'rejected') then
    raise exception 'Cette campagne est déjà close.' using errcode = '23514';
  end if;
  perform set_config('app.change_reason', btrim(p_reason), true);
  update public.sponsored_campaigns set status = p_status where id = p_campaign;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'campagne.statut', 'sponsored_campaigns', p_campaign,
          jsonb_build_object('avant', v_old, 'apres', p_status, 'raison', btrim(p_reason)));
end;
$$;
revoke execute on function public.admin_set_campaign_status(uuid, public.campaign_status, text) from public, anon;
