-- =============================================================================
-- Niveau 13 : nombre de contenus publiés et visibles par catégorie (sous-
-- catégories comprises), pour ne proposer un lien que si des données existent.
-- Droits de l'appelant : seuls les contenus qu'il peut lire sont comptés.
-- =============================================================================
create or replace function public.category_content_counts(p_city uuid, p_slugs text[])
returns table (slug text, total bigint)
language sql stable security invoker set search_path = '' as $$
  with recursive tree as (
    select c.slug as root, c.id from public.categories c where c.slug = any (p_slugs) and c.is_active
    union all
    select t.root, c.id from public.categories c join tree t on c.parent_id = t.id where c.is_active
  )
  select t.root,
    (select count(*) from public.listings l where l.category_id = any (array_agg(t.id)) and l.city_id = p_city and l.status = 'published')
    + (select count(*) from public.places p where p.category_id = any (array_agg(t.id)) and p.city_id = p_city and p.status = 'published')
    + (select count(*) from public.business_profiles b where b.category_id = any (array_agg(t.id)) and b.city_id = p_city and b.status = 'published')
  from tree t
  group by t.root
$$;
revoke execute on function public.category_content_counts(uuid, text[]) from public;
grant execute on function public.category_content_counts(uuid, text[]) to anon, authenticated;
