-- =============================================================================
-- Niveau 22 (correctif) : la suspension d'un contenu publié après signalement
-- prévient son auteur (la notification de modération existante ne couvrait que
-- les décisions sur un contenu en attente).
-- =============================================================================
create or replace function public.handle_report(p_report uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_report public.reports;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_target uuid;
  v_status public.report_status;
  v_owner uuid;
  v_title text;
  v_link text;
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
      select owner_id, 'Annonce suspendue : ' || title, '/tableau-de-bord/annonces' into v_owner, v_title, v_link from public.listings where id = v_report.listing_id;
    elsif v_report.place_id is not null then
      update public.places set status = 'rejected', rejection_reason = 'Suspendu après signalement : ' || v_note
      where id = v_report.place_id and status <> 'rejected';
      select coalesce(manager_id, created_by), 'Vitrine suspendue : ' || name, '/lieux/' || slug into v_owner, v_title, v_link from public.places where id = v_report.place_id;
    elsif v_report.event_id is not null then
      update public.events set status = 'rejected', rejection_reason = 'Suspendu après signalement : ' || v_note
      where id = v_report.event_id and status <> 'rejected';
      select organizer_id, 'Événement suspendu : ' || title, '/evenements/mes-evenements' into v_owner, v_title, v_link from public.events where id = v_report.event_id;
    elsif v_report.business_id is not null then
      update public.business_profiles set status = 'rejected', rejection_reason = 'Suspendue après signalement : ' || v_note
      where id = v_report.business_id and status <> 'rejected';
      select owner_id, 'Page professionnelle suspendue : ' || name, '/mes-pages-pro' into v_owner, v_title, v_link from public.business_profiles where id = v_report.business_id;
    elsif v_report.comment_id is not null then
      update public.listing_comments set status = 'hidden', hidden_reason = left(v_note, 300)
      where id = v_report.comment_id and status = 'visible';
      select c.author_id, 'Commentaire masqué par la modération', '/annonces/' || l.slug into v_owner, v_title, v_link
      from public.listing_comments c join public.listings l on l.id = c.listing_id where c.id = v_report.comment_id;
    elsif v_report.review_id is not null then
      update public.reviews set status = 'hidden' where id = v_report.review_id and status <> 'hidden';
      select author_id, 'Avis masqué par la modération', '/tableau-de-bord/activite' into v_owner, v_title, v_link from public.reviews where id = v_report.review_id;
    else
      raise exception 'Ce contenu ne se suspend pas d''ici : article du guide (rédaction) ou message (suspendre le compte).'
        using errcode = '22023';
    end if;
    -- Décision de modération : toujours envoyée (catégorie non désactivable).
    if v_owner is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_owner, 'moderation', left(v_title, 120), 'Motif : ' || v_note || ' Corrigez puis soumettez à nouveau, ou contactez l''équipe.', v_link);
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
