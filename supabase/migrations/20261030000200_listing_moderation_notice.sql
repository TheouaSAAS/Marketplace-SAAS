-- =============================================================================
-- Niveau 17 : décision de modération d'une annonce (dont les offres d'emploi)
-- notifiée à son auteur : publication, ou refus avec le motif.
-- =============================================================================
create or replace function public.notify_listing_moderation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and old.status = 'pending' and new.status in ('published', 'rejected') then
    insert into public.notifications (user_id, type, title, body, link)
    values (new.owner_id, 'annonce',
            case when new.status = 'published' then 'Annonce publiée : ' else 'Annonce refusée : ' end || new.title,
            case when new.status = 'rejected' then new.rejection_reason end,
            '/annonces/' || new.slug);
  end if;
  return new;
end;
$$;
create trigger listings_notify_moderation after update of status on public.listings
  for each row execute function public.notify_listing_moderation();
