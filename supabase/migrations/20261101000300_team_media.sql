-- =============================================================================
-- Niveau 19 : les membres habilités d'une équipe voient et retirent les photos
-- privées de leur page ou de leurs annonces, même déposées par un collègue.
-- =============================================================================
create or replace function public.can_manage_private_media(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.images i
    left join public.business_profiles b on b.id = i.business_id
    left join public.listings l on l.id = i.listing_id
    where i.storage_path = p_path and i.bucket = 'private-media'
      and ((b.id is not null and public.can_manage_content(b.owner_id, b.organization_id))
        or (l.id is not null and public.can_manage_content(l.owner_id, l.organization_id)))
  )
$$;
revoke execute on function public.can_manage_private_media(text) from public, anon;
grant execute on function public.can_manage_private_media(text) to authenticated;

create policy private_media_team_read on storage.objects for select to authenticated
  using (bucket_id = 'private-media' and public.can_manage_private_media(name));
create policy private_media_team_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and public.can_manage_private_media(name));
