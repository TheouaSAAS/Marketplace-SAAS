-- =============================================================================
-- Correctif : créer une organisation en relisant la ligne (insert … returning,
-- ou insert().select() côté client) échouait.
--
-- Détecté par supabase/tests/level2.sql : la ligne renvoyée doit satisfaire la
-- règle de lecture, or l'adhésion du créateur n'est ajoutée qu'après coup par
-- un déclencheur. Le créateur peut désormais lire l'organisation qu'il a créée.
-- =============================================================================

drop policy organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated using (
  created_by = (select auth.uid())
  or public.is_org_member(id)
  or (select public.is_staff())
);
