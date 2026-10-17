-- =============================================================================
-- Carrefour des Possibles — Données de référence
-- Idempotent : peut être rejoué sans créer de doublons.
--
-- Contient UNIQUEMENT du référentiel (ville de lancement, catégories,
-- offres, paramètres). Aucun établissement, annonce ni événement fictif.
-- Les quartiers sont dans seeds/quartiers_san_pedro.sql (liste à valider).
-- =============================================================================

-- Ville de lancement. Centre approximatif du centre-ville (position de la carte par défaut).
insert into public.cities (slug, name, region, center, default_zoom, launch_status, is_active, is_default, settings)
values (
  'san-pedro',
  'San Pedro',
  'San-Pédro',
  extensions.st_setsrid(extensions.st_makepoint(-6.6363, 4.7485), 4326)::extensions.geography,
  13,
  'pilot',
  true,
  true,
  '{"search_radii_m": [1000, 5000, 10000, 25000]}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  region = excluded.region,
  launch_status = excluded.launch_status,
  is_active = excluded.is_active,
  is_default = excluded.is_default;

-- -----------------------------------------------------------------------------
-- Catégories (modifiables ensuite depuis l'administration)
-- Les slugs utilisés par src/config/navigation.ts doivent rester présents.
-- -----------------------------------------------------------------------------
insert into public.categories (family, slug, name, icon, content_types, attribute_schema, sort_order) values
  -- DÉCOUVRIR
  ('decouvrir', 'lieux-a-visiter', 'Lieux à visiter', 'landmark', '{place}', null, 10),
  ('decouvrir', 'plages-sites-naturels', 'Plages et sites naturels', 'waves', '{place}', null, 20),
  ('decouvrir', 'restaurants-gastronomie', 'Restaurants et gastronomie', 'utensils', '{place,business}', null, 30),
  ('decouvrir', 'hotels-hebergements', 'Hôtels et hébergements', 'bed-double', '{place,business}', null, 40),
  ('decouvrir', 'loisirs-activites', 'Loisirs et activités', 'bike', '{place,event,business}', null, 50),
  ('decouvrir', 'evenements', 'Événements', 'calendar-days', '{event}', null, 60),
  -- TROUVER
  ('trouver', 'immobilier', 'Immobilier', 'house', '{listing,business}', 'immobilier', 10),
  ('trouver', 'emploi-stages', 'Emploi et stages', 'briefcase', '{listing}', 'emploi', 20),
  ('trouver', 'annonces-biens', 'Annonces de biens', 'package', '{listing}', 'bien', 30),
  ('trouver', 'vehicules', 'Véhicules', 'car', '{listing,business}', 'vehicule', 40),
  ('trouver', 'commerces-boutiques', 'Commerces et boutiques', 'store', '{place,business}', null, 50),
  ('trouver', 'services-professionnels', 'Services professionnels', 'wrench', '{place,business,listing}', 'service', 60),
  ('trouver', 'transport-livraison', 'Transport et livraison', 'truck', '{place,business,listing}', 'service', 70),
  ('trouver', 'formation', 'Formation', 'graduation-cap', '{listing,place,business}', 'formation', 80),
  ('trouver', 'opportunites-commerciales', 'Opportunités commerciales', 'handshake', '{listing}', 'opportunite', 90),
  ('trouver', 'appels-offres', 'Appels d’offres', 'file-text', '{listing}', 'appel_offres', 100)
on conflict (slug) do update set
  family = excluded.family,
  name = excluded.name,
  icon = excluded.icon,
  content_types = excluded.content_types,
  attribute_schema = excluded.attribute_schema,
  sort_order = excluded.sort_order;

-- Sous-catégories.
insert into public.categories (parent_id, family, slug, name, content_types, attribute_schema, sort_order)
select parent.id, parent.family, child.slug, child.name, child.content_types::public.content_type[], parent.attribute_schema, child.sort_order
from (values
  ('evenements', 'concerts-spectacles', 'Concerts et spectacles', '{event}', 10),
  ('evenements', 'sport', 'Sport', '{event}', 20),
  ('evenements', 'culture-traditions', 'Culture et traditions', '{event}', 30),
  ('evenements', 'salons-conferences', 'Salons et conférences', '{event}', 40),
  ('immobilier', 'immobilier-location', 'Location', '{listing}', 10),
  ('immobilier', 'immobilier-vente', 'Vente', '{listing}', 20),
  ('immobilier', 'terrains', 'Terrains', '{listing}', 30),
  ('immobilier', 'locaux-professionnels', 'Bureaux et locaux commerciaux', '{listing}', 40),
  ('emploi-stages', 'offres-emploi', 'Offres d’emploi', '{listing}', 10),
  ('emploi-stages', 'stages', 'Stages', '{listing}', 20),
  ('emploi-stages', 'demandes-emploi', 'Demandes d’emploi', '{listing}', 30),
  ('annonces-biens', 'maison-ameublement', 'Maison et ameublement', '{listing}', 10),
  ('annonces-biens', 'electronique-telephonie', 'Électronique et téléphonie', '{listing}', 20),
  ('annonces-biens', 'mode-accessoires', 'Mode et accessoires', '{listing}', 30),
  ('annonces-biens', 'autres-biens', 'Autres biens', '{listing}', 40),
  ('vehicules', 'voitures', 'Voitures', '{listing}', 10),
  ('vehicules', 'motos', 'Motos', '{listing}', 20),
  ('vehicules', 'pieces-detachees', 'Pièces détachées', '{listing}', 30),
  ('commerces-boutiques', 'alimentation', 'Alimentation', '{place,business}', 10),
  ('commerces-boutiques', 'mode-beaute', 'Mode et beauté', '{place,business}', 20),
  ('commerces-boutiques', 'quincaillerie-materiaux', 'Quincaillerie et matériaux', '{place,business}', 30),
  ('commerces-boutiques', 'telephonie-informatique', 'Téléphonie et informatique', '{place,business}', 40),
  ('services-professionnels', 'artisans-depannage', 'Artisans et dépannage', '{place,business,listing}', 10),
  ('services-professionnels', 'sante', 'Santé', '{place,business}', 20),
  ('services-professionnels', 'beaute-bien-etre', 'Beauté et bien-être', '{place,business,listing}', 30),
  ('services-professionnels', 'services-aux-entreprises', 'Services aux entreprises', '{place,business,listing}', 40)
) as child (parent_slug, slug, name, content_types, sort_order)
join public.categories parent on parent.slug = child.parent_slug
on conflict (slug) do update set
  parent_id = excluded.parent_id,
  family = excluded.family,
  name = excluded.name,
  content_types = excluded.content_types,
  attribute_schema = excluded.attribute_schema,
  sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Offres. Les tarifs Pro et Premium ne sont PAS fixés : à définir dans
-- l'administration avant activation (is_active = false jusque-là).
-- -----------------------------------------------------------------------------
insert into public.plans (code, name, description, price_xof, billing_period, limits, features, is_active, sort_order) values
  ('gratuit', 'Gratuit', 'Consultation, compte utilisateur et publication limitée.', 0, 'month',
   '{"max_active_listings": 3, "max_images_per_listing": 5, "stats": "none", "featured_slots": 0}',
   '{"Consultation publique","Compte utilisateur","Favoris","Publication gratuite limitée"}', true, 10),
  ('pro', 'Professionnel', 'Fiche entreprise, gestion des publications et statistiques de base.', 0, 'month',
   '{"max_active_listings": 20, "max_images_per_listing": 10, "stats": "basic", "featured_slots": 0}',
   '{"Fiche entreprise","Gestion des publications","Réception des demandes","Statistiques de base"}', false, 20),
  ('premium', 'Premium', 'Visibilité renforcée, annonces sponsorisées et statistiques avancées.', 0, 'month',
   '{"max_active_listings": 100, "max_images_per_listing": 20, "stats": "advanced", "featured_slots": 3}',
   '{"Tout le plan Professionnel","Visibilité renforcée","Galerie enrichie","Statistiques avancées","Mise en avant"}', false, 30)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Paramètres de la plateforme
-- -----------------------------------------------------------------------------
insert into public.platform_settings (key, value, description, is_public) values
  ('listings.default_duration', '{"days": 60}', 'Durée de diffusion par défaut d’une annonce publiée.', true),
  ('geo.search_radii', '{"meters": [1000, 5000, 10000, 25000]}', 'Rayons de recherche proposés autour de l’utilisateur.', true),
  ('moderation.require_review', '{"enabled": true}', 'Les nouvelles publications passent par la modération.', true)
on conflict (key) do nothing;
