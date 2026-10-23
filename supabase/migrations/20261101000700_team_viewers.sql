-- =============================================================================
-- Niveau 19 : un membre « Lecteur » d'une équipe consulte la page de l'équipe,
-- même non publiée (espace de gestion en lecture seule). Modifier reste réservé
-- aux éditeurs et plus (règle de mise à jour inchangée).
-- =============================================================================
drop policy business_profiles_select on public.business_profiles;
create policy business_profiles_select on public.business_profiles for select using (
  (status = 'published' and public.verification_publicly_visible(verification_status))
  or public.can_manage_content(owner_id, organization_id)
  or (organization_id is not null and public.is_org_member(organization_id))
  or (select public.is_staff())
  or (select public.is_curator())
);
