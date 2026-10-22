-- =============================================================================
-- Suppression de TOUTES les données de démonstration (supabase/seeds/demo.sql).
-- Ne touche qu'aux contenus du compte de démonstration au statut `placeholder`.
-- =============================================================================
delete from public.guide_articles where slug like 'exemple-%' and verification_status = 'placeholder';
delete from public.events where organizer_id = '00000000-0000-4000-8000-00000000d3e0' and verification_status = 'placeholder';
delete from public.listings where owner_id = '00000000-0000-4000-8000-00000000d3e0' and verification_status = 'placeholder';
delete from public.business_profiles where owner_id = '00000000-0000-4000-8000-00000000d3e0' and verification_status = 'placeholder';
delete from public.places where created_by = '00000000-0000-4000-8000-00000000d3e0' and verification_status = 'placeholder';
delete from auth.users where id = '00000000-0000-4000-8000-00000000d3e0';
