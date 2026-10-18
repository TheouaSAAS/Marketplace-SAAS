-- =============================================================================
-- Correctif : un utilisateur ayant payé ne pouvait pas supprimer son compte.
--
-- Détecté par supabase/tests/level3_accounts.sql : la suppression du compte
-- supprimait en cascade ses abonnements et campagnes ; la référence du paiement
-- devenait nulle et violait `payments_check` (un paiement justifie exactement
-- un abonnement ou une campagne). Abonnements et campagnes sont désormais
-- conservés, détachés du compte, comme les paiements qu'ils justifient.
-- =============================================================================

alter table public.subscriptions alter column user_id drop not null;
alter table public.subscriptions drop constraint subscriptions_user_id_fkey;
alter table public.subscriptions add constraint subscriptions_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.sponsored_campaigns alter column owner_id drop not null;
alter table public.sponsored_campaigns drop constraint sponsored_campaigns_owner_id_fkey;
alter table public.sponsored_campaigns add constraint sponsored_campaigns_owner_id_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;
