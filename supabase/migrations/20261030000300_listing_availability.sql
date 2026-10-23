-- =============================================================================
-- Niveau 17 : changer la disponibilité d'un contenu (offre clôturée, bien loué,
-- article vendu) n'en modifie pas le contenu : l'auteur peut le faire sans
-- renvoyer la publication en modération ni perdre sa vérification.
-- Seule différence avec la définition précédente : `availability_status` rejoint
-- la liste des champs ignorés par la comparaison.
-- =============================================================================
create or replace function public.enforce_content_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_column text := tg_argv[0];
  v_moderator boolean := public.is_staff() or public.is_service_context();
  v_curator boolean := public.is_curator() or public.is_service_context();
  v_new jsonb := to_jsonb(new);
  v_moderation_fields text[] := array['published_at', 'rejection_reason', 'view_count', 'expires_at'];
  v_verification_fields text[] := array['verification_status', 'verified_at', 'verified_by', 'source_id', 'verification_note'];
  v_ignored text[] := array['status', 'updated_at', 'search_vector', 'view_count', 'location_public', 'availability_status'];
  v_patch jsonb;
  v_default_days integer;
begin
  if tg_op = 'INSERT' then
    if not v_moderator and not (v_curator and tg_table_name in ('places', 'events'))
       and new.status not in ('draft', 'pending') then
      raise exception 'Un contenu ne peut être créé qu''en brouillon ou en attente de vérification.'
        using errcode = '42501';
    end if;
    if not v_moderator then
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_patch
      from jsonb_each('{"published_at": null, "rejection_reason": null, "view_count": 0, "expires_at": null}'::jsonb)
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);
    end if;
    if not v_curator then
      new := jsonb_populate_record(new, '{"verification_status": "pending_validation", "verified_at": null,
        "verified_by": null, "source_id": null, "verification_note": null}'::jsonb);
    end if;
  else
    if not v_moderator then
      select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key), '{}'::jsonb) into v_patch
      from unnest(v_moderation_fields || v_owner_column) as key
      where v_new ? key;
      new := jsonb_populate_record(new, v_patch);
    end if;
    if not v_curator then
      select coalesce(jsonb_object_agg(key, to_jsonb(old) -> key), '{}'::jsonb) into v_patch
      from unnest(v_verification_fields) as key;
      new := jsonb_populate_record(new, v_patch);
    end if;

    if not v_moderator and not v_curator
       and (to_jsonb(new) - v_ignored - v_verification_fields) is distinct from (to_jsonb(old) - v_ignored - v_verification_fields) then
      -- Une modification par l'auteur renvoie une publication en modération…
      if old.status = 'published' and new.status = 'published' then
        new.status := 'pending';
      end if;
      -- … et une donnée vérifiée redevient « à vérifier ».
      if old.verification_status = 'verified' then
        new.verification_status := 'pending_validation';
      end if;
    end if;

    if new.status is distinct from old.status
       and not public.content_transition_allowed(
         old.status,
         new.status,
         v_moderator,
         public.can_manage_content((to_jsonb(old) ->> v_owner_column)::uuid, (to_jsonb(old) ->> 'organization_id')::uuid)
       )
       and not (old.status = 'published' and new.status = 'pending' and not v_moderator)
       -- Les éditeurs locaux publient et archivent les données locales qu'ils administrent.
       and not (v_curator and tg_table_name in ('places', 'events', 'neighborhoods')) then
      raise exception 'Changement de statut non autorisé (% → %).', old.status, new.status
        using errcode = '42501';
    end if;
  end if;

  -- Vérification : date et responsable renseignés automatiquement.
  if new.verification_status = 'verified'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
    new.verified_at := coalesce(new.verified_at, now());
    new.verified_by := coalesce(new.verified_by, (select auth.uid()));
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if v_new ? 'published_at' then
      new := jsonb_populate_record(new, jsonb_build_object('published_at', now()));
    end if;
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
