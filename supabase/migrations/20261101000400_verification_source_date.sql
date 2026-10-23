-- =============================================================================
-- Niveau 19 : la source d'une vérification porte sa date de collecte (obligatoire).
-- =============================================================================
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
    insert into public.sources (kind, title, collected_at, created_by) values ('terrain', btrim(p_source_title), now(), (select auth.uid())) returning id into v_source;
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
