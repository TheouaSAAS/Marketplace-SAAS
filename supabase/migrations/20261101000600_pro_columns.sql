-- =============================================================================
-- Niveau 19 : les nouvelles colonnes publiques des pages (FAQ, liens, revendicable)
-- deviennent lisibles ; l'adresse et la position exacte restent masquées.
-- =============================================================================
select public.grant_public_columns('business_profiles', array['location', 'address_text']);
