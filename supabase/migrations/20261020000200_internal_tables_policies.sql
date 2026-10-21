-- =============================================================================
-- Niveau 8 : tables internes sans accès direct par l'API (règle explicite,
-- comme `rate_limit_buckets`). Elles ne sont lues et écrites que par des
-- fonctions SECURITY DEFINER (`record_listing_view`, `listing_engagement`,
-- `reveal_listing_contact`).
-- =============================================================================
create policy listing_view_counts_none on public.listing_view_counts for select using (false);
create policy listing_view_marks_none on public.listing_view_marks for select using (false);
create policy contact_reveals_none on public.contact_reveals for select using (false);
