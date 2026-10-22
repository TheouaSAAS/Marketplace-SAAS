-- =============================================================================
-- Niveau 10 : services de proximité.
-- - Métiers = catégories du référentiel (administrables), avec mots-clés
--   administrables pour la recherche en langage courant.
-- - Fiche professionnelle : prestations, zone desservie, disponibilité
--   DÉCLARÉE et datée (jamais présentée comme du temps réel).
-- - Demande de devis : coordonnées transmises seulement avec accord explicite.
-- =============================================================================

-- Mots-clés d'une catégorie (synonymes, problèmes courants : « fuite », « clim »…).
alter table public.categories add column keywords text[] not null default '{}';

-- Métiers (choix produit, à valider localement ; modifiables depuis l'administration).
insert into public.categories (parent_id, family, slug, name, content_types, attribute_schema, sort_order, keywords)
select parent.id, parent.family, v.slug, v.name, '{place,business,listing}'::public.content_type[], 'service', v.sort_order, v.keywords::text[]
from (values
  ('artisans-depannage', 'plomberie', 'Plomberie', 10, '{plombier,plomberie,fuite,robinet,canalisation,"chauffe-eau",wc,toilettes}'),
  ('artisans-depannage', 'electricite', 'Électricité', 20, '{electricien,electricite,"panne de courant","court-circuit",prise,disjoncteur,cablage}'),
  ('artisans-depannage', 'climatisation', 'Climatisation et froid', 30, '{climatisation,clim,climatiseur,frigoriste,refrigerateur,congelateur}'),
  ('artisans-depannage', 'mecanique-auto', 'Mécanique automobile', 40, '{mecanicien,mecanique,garage,voiture,moto,vidange,"ne demarre pas"}'),
  ('artisans-depannage', 'menuiserie', 'Menuiserie', 50, '{menuisier,menuiserie,porte,fenetre,meuble}'),
  ('artisans-depannage', 'maconnerie', 'Maçonnerie et bâtiment', 60, '{macon,maconnerie,construction,carrelage,fissure}'),
  ('artisans-depannage', 'peinture-batiment', 'Peinture', 70, '{peintre,peinture}'),
  ('beaute-bien-etre', 'coiffure', 'Coiffure', 10, '{coiffeur,coiffeuse,coiffure,tresses,barbier}'),
  ('services-aux-entreprises', 'informatique', 'Informatique et téléphonie', 10, '{informaticien,informatique,ordinateur,"site web",reseau,telephone,reparation}'),
  ('services-aux-entreprises', 'nettoyage', 'Nettoyage', 20, '{nettoyage,menage,entretien,desinsectisation}'),
  ('services-aux-entreprises', 'photographie', 'Photographie et vidéo', 30, '{photographe,photographie,video,mariage,reportage}'),
  ('transport-livraison', 'demenagement', 'Déménagement', 10, '{demenagement,demenageur,transport de meubles}')
) as v(parent_slug, slug, name, sort_order, keywords)
join public.categories parent on parent.slug = v.parent_slug
on conflict (slug) do update set keywords = excluded.keywords;

-- -----------------------------------------------------------------------------
-- Fiche professionnelle
-- -----------------------------------------------------------------------------
alter table public.business_profiles
  add column services text[] not null default '{}' check (cardinality(services) <= 30),
  add column service_area text check (service_area is null or char_length(service_area) <= 300),
  add column accepts_quotes boolean not null default true,
  -- Disponibilité déclarée par le professionnel, toujours affichée avec sa date.
  add column availability_note text check (availability_note is null or char_length(availability_note) <= 200),
  add column availability_declared_at timestamptz;

select public.grant_public_columns('business_profiles', array['location', 'address_text']);

-- La date de déclaration suit la note de disponibilité (jamais fournie par le client).
create or replace function public.stamp_business_availability()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.availability_note is distinct from old.availability_note then
    new.availability_declared_at := case when nullif(btrim(coalesce(new.availability_note, '')), '') is null then null else now() end;
  else
    new.availability_declared_at := old.availability_declared_at;
  end if;
  return new;
end;
$$;
create trigger business_profiles_availability before insert or update on public.business_profiles
  for each row execute function public.stamp_business_availability();

-- -----------------------------------------------------------------------------
-- Demande de devis : détails structurés + accord explicite de transmission
-- -----------------------------------------------------------------------------
alter table public.contact_requests
  add column details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  add column consented_at timestamptz,
  add constraint contact_requests_quote_consent check (kind <> 'devis' or consented_at is not null);

create or replace function public.enforce_quote_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind <> 'devis' or public.is_service_request() then
    return new;
  end if;
  if new.business_id is null
     or not exists (select 1 from public.business_profiles b where b.id = new.business_id and b.accepts_quotes and b.status = 'published') then
    raise exception 'Ce professionnel ne reçoit pas de demandes de devis.' using errcode = '23514';
  end if;
  if (select count(*) from public.contact_requests where sender_id = new.sender_id and kind = 'devis' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Trop de demandes de devis en peu de temps. Réessayez plus tard.' using errcode = 'CP429';
  end if;
  new.consented_at := coalesce(new.consented_at, now());
  new.status := 'new';
  return new;
end;
$$;
create trigger contact_requests_quote_rules before insert on public.contact_requests
  for each row execute function public.enforce_quote_rules();

-- -----------------------------------------------------------------------------
-- Recherche de professionnels (droits de l'appelant)
-- Ordre public : vérification à jour, disponibilité déclarée récemment, puis
-- fiche la plus récemment mise à jour ; ou distance si demandée. Aucun paiement.
-- -----------------------------------------------------------------------------
create or replace function public.search_professionals(
  p_city uuid,
  p_categories uuid[] default null,
  p_query text default null,
  p_neighborhood uuid default null,
  p_verified_only boolean default false,
  p_available_days integer default null,
  p_contact text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m integer default null,
  p_sort text default 'pertinence',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (id uuid, distance_m double precision, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with point as (
    select case when p_lat between -90 and 90 and p_lng between -180 and 180
      then extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography end as geo
  ),
  matches as (
    select b.id,
      case when pt.geo is not null and b.location_public is not null then extensions.st_distance(b.location_public, pt.geo) end as distance_m,
      (b.verification_status = 'verified' and b.verified_at >= now() - interval '365 days') as verified,
      (b.availability_declared_at >= now() - interval '30 days') as available,
      b.updated_at
    from public.business_profiles b, point pt
    where b.city_id = p_city
      and b.status = 'published'
      and (p_categories is null or b.category_id = any (p_categories))
      and (public.search_normalize(p_query) = ''
        or b.search_vector @@ public.search_tsquery(p_query)
        or public.search_normalize(p_query) operator(extensions.<%) public.immutable_unaccent(b.name)
        or exists (select 1 from unnest(b.services) s where public.immutable_unaccent(lower(s)) like '%' || public.search_normalize(p_query) || '%'))
      and (p_neighborhood is null or b.neighborhood_id = p_neighborhood)
      and (not p_verified_only or (b.verification_status = 'verified' and b.verified_at >= now() - interval '365 days'))
      and (p_available_days is null or b.availability_declared_at >= now() - make_interval(days => p_available_days))
      and (p_contact is null
        or (p_contact = 'devis' and b.accepts_quotes)
        or (p_contact = 'telephone' and nullif(btrim(b.phone), '') is not null)
        or (p_contact = 'whatsapp' and nullif(btrim(b.whatsapp), '') is not null))
      and (p_radius_m is null or pt.geo is null
        or (b.location_public is not null and extensions.st_dwithin(b.location_public, pt.geo, least(greatest(p_radius_m, 100), 100000))))
  )
  select m.id, m.distance_m, count(*) over ()
  from matches m
  order by
    case when p_sort = 'proximite' then m.distance_m end asc nulls last,
    m.verified desc,
    m.available desc,
    m.updated_at desc,
    m.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke execute on function public.search_professionals(uuid, uuid[], text, uuid, boolean, integer, text, double precision, double precision, integer, text, integer, integer) from public;
grant execute on function public.search_professionals(uuid, uuid[], text, uuid, boolean, integer, text, double precision, double precision, integer, text, integer, integer) to anon, authenticated;
