-- =============================================================================
-- Rubriques des annonces (travaux préalables au niveau 28).
--
-- A. Arborescence administrable : jusqu'à quatre niveaux (rubrique, sous-rubrique,
--    sous-catégorie, catégorie détaillée), déplacement sans cycle, champs actifs
--    par catégorie, suppression seulement après reprise des contenus rattachés.
-- B. Recherche des annonces publiées de toutes les rubriques, avec filtres sur
--    les caractéristiques (état, marque, année…).
-- C, D. Arborescences de départ « Biens et objets » et « Véhicules », complétées
--    sans doublon (les catégories et annonces existantes sont conservées).
-- =============================================================================

-- Champs du schéma proposés pour cette catégorie (null : tous les champs du schéma).
alter table public.categories
  add column attribute_fields text[] check (attribute_fields is null or array_length(attribute_fields, 1) <= 30);

-- -----------------------------------------------------------------------------
-- Arbre : pas de cycle, quatre niveaux au plus, même famille que le parent
-- -----------------------------------------------------------------------------
create or replace function public.protect_category_tree()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_depth integer := 0;
  v_cursor uuid := new.parent_id;
  v_parent public.categories;
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'Une catégorie ne peut pas être sa propre parente.' using errcode = '23514';
  end if;
  select * into v_parent from public.categories where id = new.parent_id;
  if v_parent.id is null then
    raise exception 'Catégorie parente introuvable.' using errcode = '23503';
  end if;
  if v_parent.family <> new.family then
    raise exception 'La catégorie parente doit appartenir à la même famille.' using errcode = '23514';
  end if;
  while v_cursor is not null loop
    if v_cursor = new.id then
      raise exception 'Déplacement impossible : la catégorie deviendrait sa propre descendante.' using errcode = '23514';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 3 then
      raise exception 'Quatre niveaux au plus : rubrique, sous-rubrique, sous-catégorie, catégorie détaillée.' using errcode = '23514';
    end if;
    select parent_id into v_cursor from public.categories where id = v_cursor;
  end loop;
  -- Les descendants d'une catégorie déplacée ne doivent pas dépasser la profondeur maximale.
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id then
    if exists (
      with recursive below as (
        select id, 1 as level from public.categories where parent_id = new.id
        union all
        select c.id, b.level + 1 from public.categories c join below b on c.parent_id = b.id
      )
      select 1 from below where v_depth + level > 3
    ) then
      raise exception 'Déplacement impossible : ses sous-catégories dépasseraient quatre niveaux.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger categories_tree before insert or update of parent_id, family on public.categories
  for each row execute function public.protect_category_tree();

-- Utilisation d'une catégorie (administration) : contenus rattachés par statut.
create or replace function public.admin_category_usage()
returns table (category_id uuid, children integer, listings_published integer, listings_other integer, places integer, events integer, businesses integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  return query
  select c.id,
    (select count(*)::integer from public.categories k where k.parent_id = c.id),
    (select count(*)::integer from public.listings l where l.category_id = c.id and l.status = 'published'),
    (select count(*)::integer from public.listings l where l.category_id = c.id and l.status <> 'published'),
    (select count(*)::integer from public.places p where p.category_id = c.id),
    (select count(*)::integer from public.events e where e.category_id = c.id),
    (select count(*)::integer from public.business_profiles b where b.category_id = c.id)
  from public.categories c;
end;
$$;
revoke execute on function public.admin_category_usage() from public, anon;

-- Suppression : sous-catégories d'abord déplacées ; contenus rattachés repris dans une
-- autre catégorie active (obligatoire s'il y en a), puis suppression journalisée.
create or replace function public.delete_category(p_category uuid, p_move_to uuid, p_reason text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_category public.categories;
  v_target public.categories;
  v_used integer;
  v_moved integer := 0;
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Indiquez la raison de la suppression (5 caractères au moins).' using errcode = '23514';
  end if;
  select * into v_category from public.categories where id = p_category for update;
  if v_category.id is null then
    raise exception 'Catégorie introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.categories where parent_id = p_category) then
    raise exception 'Déplacez ou supprimez d’abord ses sous-catégories.' using errcode = '23514';
  end if;
  select (select count(*) from public.listings where category_id = p_category)
       + (select count(*) from public.places where category_id = p_category)
       + (select count(*) from public.events where category_id = p_category)
       + (select count(*) from public.business_profiles where category_id = p_category)
  into v_used;
  if v_used > 0 then
    if p_move_to is null then
      raise exception 'Cette catégorie a % contenu(s) rattaché(s) : choisissez la catégorie qui les reprend.', v_used using errcode = '23514';
    end if;
    select * into v_target from public.categories where id = p_move_to;
    if v_target.id is null or not v_target.is_active or v_target.id = p_category or v_target.family <> v_category.family then
      raise exception 'Catégorie de reprise introuvable, inactive ou d’une autre famille.' using errcode = '23514';
    end if;
  end if;
  perform set_config('app.change_reason', 'Suppression de la catégorie « ' || v_category.name || ' » : ' || btrim(p_reason), true);
  update public.listings set category_id = p_move_to where category_id = p_category;
  get diagnostics n = row_count; v_moved := v_moved + n;
  update public.places set category_id = p_move_to where category_id = p_category;
  get diagnostics n = row_count; v_moved := v_moved + n;
  update public.events set category_id = p_move_to where category_id = p_category;
  get diagnostics n = row_count; v_moved := v_moved + n;
  update public.business_profiles set category_id = p_move_to where category_id = p_category;
  get diagnostics n = row_count; v_moved := v_moved + n;
  update public.sponsored_campaigns set category_id = p_move_to where category_id = p_category;
  delete from public.categories where id = p_category;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'categorie.suppression', 'categories', p_category,
          jsonb_build_object('nom', v_category.name, 'slug', v_category.slug, 'reprise', p_move_to, 'contenus', v_moved, 'raison', btrim(p_reason),
                             'avant', 'existante', 'apres', 'supprimée'));
  return v_moved;
end;
$$;
revoke execute on function public.delete_category(uuid, uuid, text) from public, anon;

-- -----------------------------------------------------------------------------
-- Recherche des annonces de toutes les rubriques, filtres de caractéristiques
-- -----------------------------------------------------------------------------
-- p_eq   : valeurs exactes (choix, oui/non)       {"etat": "bon", "carburant": "diesel"}
-- p_text : textes, sans casse ni accents          {"marque": "toyota"}
-- p_min / p_max : bornes numériques                {"annee": 2015} / {"kilometrage": 120000}
-- Mêmes règles de visibilité que la recherche du site (droits de la personne qui cherche).
create or replace function public.search_listings(
  p_city uuid default null,
  p_query text default null,
  p_categories uuid[] default null,
  p_neighborhood uuid default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_available_only boolean default false,
  p_eq jsonb default null,
  p_text jsonb default null,
  p_min jsonb default null,
  p_max jsonb default null,
  p_sort text default 'recent',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (id uuid, total_count bigint)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tsq tsquery := public.search_tsquery(p_query);
  v_norm text := public.search_normalize(p_query);
  v_has_query boolean := coalesce(v_norm, '') <> '';
begin
  return query
  select l.id, count(*) over ()
  from public.listings l
  where l.status = 'published'
    and (l.expires_at is null or l.expires_at > now())
    and public.verification_publicly_visible(l.verification_status)
    and coalesce(public.listing_schema(l.category_id), '') not in ('emploi', 'opportunite', 'appel_offres')
    and (p_city is null or l.city_id = p_city)
    and (not v_has_query or (v_tsq is not null and l.search_vector @@ v_tsq) or v_norm operator(extensions.<%) public.immutable_unaccent(l.title))
    and (p_categories is null or l.category_id = any (p_categories))
    and (p_neighborhood is null or l.neighborhood_id = p_neighborhood)
    and (p_price_min is null or l.price >= p_price_min)
    and (p_price_max is null or l.price <= p_price_max)
    and (not p_available_only or l.availability_status = 'available')
    and (p_eq is null or l.attributes @> p_eq)
    and (p_text is null or not exists (
      select 1 from jsonb_each_text(p_text) t
      where public.search_normalize(l.attributes ->> t.key) is distinct from public.search_normalize(t.value)
    ))
    and (p_min is null or not exists (
      select 1 from jsonb_each_text(p_min) t
      where not (jsonb_typeof(l.attributes -> t.key) = 'number' and (l.attributes ->> t.key)::numeric >= t.value::numeric)
    ))
    and (p_max is null or not exists (
      select 1 from jsonb_each_text(p_max) t
      where not (jsonb_typeof(l.attributes -> t.key) = 'number' and (l.attributes ->> t.key)::numeric <= t.value::numeric)
    ))
  order by
    case when p_sort = 'prix_asc' then l.price end asc nulls last,
    case when p_sort = 'prix_desc' then l.price end desc nulls last,
    case when p_sort = 'pertinence' and v_has_query then ts_rank_cd(l.search_vector, v_tsq, 32) end desc nulls last,
    coalesce(l.published_at, l.updated_at) desc,
    l.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function public.search_listings(uuid, text, uuid[], uuid, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, text, integer, integer) from public;
grant execute on function public.search_listings(uuid, text, uuid[], uuid, numeric, numeric, boolean, jsonb, jsonb, jsonb, jsonb, text, integer, integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- C. Biens et objets (rubrique existante « annonces-biens », complétée)
-- -----------------------------------------------------------------------------
update public.categories set name = 'Biens et objets', description = 'Mobilier, électroménager, téléphones, mode, bricolage, loisirs, équipement professionnel : achat et vente entre particuliers et professionnels.'
where slug = 'annonces-biens';
update public.categories set name = 'Maison, mobilier et décoration' where slug = 'maison-ameublement';
update public.categories set name = 'Téléphones et informatique' where slug = 'electronique-telephonie';
update public.categories set name = 'Autres biens et objets', sort_order = 900 where slug = 'autres-biens';

-- Insère une catégorie sous un parent désigné par son slug (rien si le slug existe déjà).
create function pg_temp.add_category(p_parent text, p_slug text, p_name text, p_order integer, p_schema text, p_keywords text[]) returns void language sql as $$
  insert into public.categories (parent_id, family, content_types, attribute_schema, slug, name, sort_order, keywords, is_active)
  select p.id, p.family, array['listing']::public.content_type[], coalesce(p_schema, p.attribute_schema), p_slug, p_name, p_order, p_keywords, true
  from public.categories p where p.slug = p_parent
  on conflict (slug) do nothing
$$;

select pg_temp.add_category('maison-ameublement', 'meubles', 'Meubles', 10, null, array['canapé', 'lit', 'armoire', 'table', 'chaise', 'salon']);
select pg_temp.add_category('maison-ameublement', 'electromenager', 'Électroménager', 20, null, array['frigo', 'réfrigérateur', 'congélateur', 'cuisinière', 'machine à laver', 'climatiseur', 'ventilateur']);
select pg_temp.add_category('maison-ameublement', 'decoration', 'Décoration', 30, null, array['tableau', 'rideaux', 'tapis', 'lampe']);
select pg_temp.add_category('maison-ameublement', 'literie-linge', 'Literie et linge de maison', 40, null, array['matelas', 'draps', 'couverture', 'moustiquaire']);

select pg_temp.add_category('electronique-telephonie', 'telephones-smartphones', 'Téléphones et smartphones', 10, null, array['téléphone', 'smartphone', 'iphone', 'samsung', 'portable']);
select pg_temp.add_category('electronique-telephonie', 'tablettes', 'Tablettes', 20, null, array['tablette', 'ipad']);
select pg_temp.add_category('electronique-telephonie', 'ordinateurs-accessoires', 'Ordinateurs et accessoires', 30, null, array['ordinateur', 'pc', 'laptop', 'portable', 'clavier', 'souris']);
select pg_temp.add_category('electronique-telephonie', 'materiel-informatique', 'Matériel informatique', 40, null, array['imprimante', 'onduleur', 'disque dur', 'routeur', 'écran']);

select pg_temp.add_category('annonces-biens', 'tv-photo-audio', 'Télévision, photo et audio', 25, null, array['télé', 'télévision', 'son', 'photo']);
select pg_temp.add_category('tv-photo-audio', 'televiseurs', 'Téléviseurs et accessoires', 10, null, array['télé', 'tv', 'décodeur', 'antenne', 'parabole']);
select pg_temp.add_category('tv-photo-audio', 'appareils-photo', 'Appareils photo', 20, null, array['appareil photo', 'caméra', 'objectif']);
select pg_temp.add_category('tv-photo-audio', 'materiel-audio', 'Matériel audio', 30, null, array['enceinte', 'baffle', 'casque', 'sono', 'ampli']);

select pg_temp.add_category('mode-accessoires', 'vetements', 'Vêtements', 10, null, array['habits', 'pagne', 'robe', 'chemise', 'pantalon']);
select pg_temp.add_category('mode-accessoires', 'chaussures', 'Chaussures', 20, null, array['chaussures', 'baskets', 'sandales']);
select pg_temp.add_category('mode-accessoires', 'sacs-accessoires', 'Sacs et accessoires', 30, null, array['sac', 'montre', 'bijoux', 'lunettes']);

select pg_temp.add_category('annonces-biens', 'bricolage-jardin-materiaux', 'Bricolage, jardin et matériaux', 50, null, array['bricolage', 'jardin', 'matériaux']);
select pg_temp.add_category('bricolage-jardin-materiaux', 'outils', 'Outils', 10, null, array['perceuse', 'meuleuse', 'outil', 'scie']);
select pg_temp.add_category('bricolage-jardin-materiaux', 'materiel-jardin', 'Matériel de jardin', 20, null, array['tondeuse', 'arrosage', 'débroussailleuse']);
select pg_temp.add_category('bricolage-jardin-materiaux', 'materiaux-equipement', 'Matériaux et équipement', 30, null, array['ciment', 'tôle', 'carreaux', 'fer', 'bois']);

select pg_temp.add_category('annonces-biens', 'sports-loisirs', 'Sports et loisirs', 60, null, array['sport', 'loisirs']);
select pg_temp.add_category('sports-loisirs', 'materiel-sport', 'Matériel de sport', 10, null, array['vélo', 'ballon', 'musculation', 'tapis de course']);
select pg_temp.add_category('sports-loisirs', 'instruments-musique', 'Instruments de musique', 20, null, array['guitare', 'piano', 'clavier', 'djembé', 'batterie']);
select pg_temp.add_category('sports-loisirs', 'jeux-loisirs', 'Jeux et loisirs', 30, null, array['console', 'jeux vidéo', 'jeu de société', 'livres']);

select pg_temp.add_category('annonces-biens', 'bebes-enfants', 'Bébés et enfants', 70, null, array['bébé', 'enfant']);
select pg_temp.add_category('bebes-enfants', 'vetements-enfants', 'Vêtements et chaussures', 10, null, array['vêtements bébé', 'chaussures enfant']);
select pg_temp.add_category('bebes-enfants', 'mobilier-equipement-enfants', 'Mobilier et équipement', 20, null, array['poussette', 'berceau', 'siège auto', 'chaise haute']);
select pg_temp.add_category('bebes-enfants', 'jouets', 'Jouets', 30, null, array['jouet', 'peluche']);

select pg_temp.add_category('annonces-biens', 'materiel-pro-agricole', 'Matériel professionnel et agricole', 80, null, array['professionnel', 'agricole']);
select pg_temp.add_category('materiel-pro-agricole', 'equipement-professionnel', 'Équipement professionnel', 10, null, array['congélateur professionnel', 'four', 'caisse', 'vitrine']);
select pg_temp.add_category('materiel-pro-agricole', 'materiel-agricole', 'Matériel agricole', 20, null, array['pulvérisateur', 'motopompe', 'semences', 'cacao']);
select pg_temp.add_category('materiel-pro-agricole', 'materiel-chantier', 'Matériel de chantier', 30, null, array['bétonnière', 'échafaudage', 'groupe électrogène']);

-- -----------------------------------------------------------------------------
-- D. Véhicules (rubrique existante, complétée) ; pièces et accessoires : schéma propre
-- -----------------------------------------------------------------------------
update public.categories set name = 'Motos et deux-roues' where slug = 'motos';
update public.categories set name = 'Pièces et accessoires', attribute_schema = 'piece', sort_order = 80 where slug = 'pieces-detachees';
update public.categories set description = 'Voitures, motos, utilitaires, engins, pièces et accessoires.' where slug = 'vehicules' and description is null;

select pg_temp.add_category('voitures', 'citadines-berlines', 'Citadines et berlines', 10, 'vehicule', array['citadine', 'berline', 'corolla', 'yaris']);
select pg_temp.add_category('voitures', 'suv-4x4', 'SUV et 4x4', 20, 'vehicule', array['suv', '4x4', 'tout-terrain', 'land cruiser', 'rav4']);
select pg_temp.add_category('voitures', 'pick-up', 'Pick-up', 30, 'vehicule', array['pick-up', 'hilux', 'navara']);
select pg_temp.add_category('voitures', 'voitures-familiales', 'Voitures familiales', 40, 'vehicule', array['familiale', 'monospace', '7 places']);

select pg_temp.add_category('motos', 'moto', 'Motos', 10, 'vehicule', array['moto', 'yamaha', 'honda']);
select pg_temp.add_category('motos', 'scooters', 'Scooters', 20, 'vehicule', array['scooter']);
select pg_temp.add_category('motos', 'tricycles', 'Tricycles', 30, 'vehicule', array['tricycle', 'moto-taxi', 'triporteur']);

select pg_temp.add_category('vehicules', 'utilitaires-transport', 'Véhicules utilitaires et transport', 40, 'vehicule', array['utilitaire', 'transport']);
select pg_temp.add_category('utilitaires-transport', 'fourgonnettes-camionnettes', 'Fourgonnettes et camionnettes', 10, 'vehicule', array['fourgonnette', 'camionnette', 'van']);
select pg_temp.add_category('utilitaires-transport', 'camions', 'Camions', 20, 'vehicule', array['camion', 'benne', 'semi-remorque']);
select pg_temp.add_category('utilitaires-transport', 'bus-minibus', 'Bus et minibus', 30, 'vehicule', array['bus', 'minibus', 'gbaka', 'massa']);

select pg_temp.add_category('vehicules', 'engins-materiel-roulant', 'Engins et matériel roulant', 60, 'vehicule', array['engin']);
select pg_temp.add_category('engins-materiel-roulant', 'engins-chantier', 'Engins de chantier', 10, 'vehicule', array['pelleteuse', 'chargeuse', 'niveleuse', 'bulldozer']);
select pg_temp.add_category('engins-materiel-roulant', 'tracteurs-materiel-agricole', 'Tracteurs et matériel agricole', 20, 'vehicule', array['tracteur', 'remorque agricole']);

select pg_temp.add_category('pieces-detachees', 'pieces-automobiles', 'Pièces automobiles', 10, 'piece', array['pièce auto', 'moteur', 'boîte de vitesses', 'amortisseur', 'phare']);
select pg_temp.add_category('pieces-detachees', 'pieces-moto', 'Pièces de moto', 20, 'piece', array['pièce moto', 'chaîne', 'carburateur']);
select pg_temp.add_category('pieces-detachees', 'pneus-jantes', 'Pneus et jantes', 30, 'piece', array['pneu', 'pneus', 'jante', 'roue']);
select pg_temp.add_category('pieces-detachees', 'accessoires-equipement-auto', 'Accessoires et équipement', 40, 'piece', array['autoradio', 'housse', 'gps', 'batterie']);

select pg_temp.add_category('vehicules', 'autres-vehicules', 'Autres véhicules', 900, 'vehicule', array['bateau', 'pirogue', 'quad']);
