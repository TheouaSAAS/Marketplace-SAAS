-- =============================================================================
-- DONNÉES DE DÉMONSTRATION — ENTIÈREMENT FICTIVES
--
-- Objectif : faire fonctionner et tester l'interface (listes, fiches, carte)
-- avant l'arrivée de contenus réels. Chaque élément :
--   * porte le statut de vérification `placeholder` (badge « Exemple · à valider
--     localement ») et un titre commençant par « Exemple — » ;
--   * ne contient AUCUN téléphone, prix, horaire, adresse ni nom de commerce réel ;
--   * a une position approximative autour du centre-ville, sans signification.
-- Visibles du public seulement si le paramètre `demo.public_placeholders` est
-- activé. Suppression complète : supabase/seeds/demo_remove.sql.
-- Idempotent.
-- =============================================================================

-- Compte technique propriétaire des exemples (aucun mot de passe : connexion impossible).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000d3e0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'demonstration@carrefour-des-possibles.invalid', '{"display_name":"Compte de démonstration"}', now(), now())
on conflict (id) do nothing;

create temp table demo_ctx on commit drop as
select
  '00000000-0000-4000-8000-00000000d3e0'::uuid as owner_id,
  (select id from public.cities where slug = 'san-pedro') as city_id,
  (select id from public.neighborhoods where slug = 'cite') as n_cite,
  (select id from public.neighborhoods where slug = 'lac') as n_lac,
  (select id from public.neighborhoods where slug = 'bardot') as n_bardot;

create function pg_temp.demo_point(dlng float, dlat float) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_makepoint(-6.6363 + dlng, 4.7485 + dlat), 4326)::extensions.geography
$$;

-- -----------------------------------------------------------------------------
-- Lieux
-- -----------------------------------------------------------------------------
insert into public.places (kind, created_by, slug, name, summary, description, category_id, city_id, neighborhood_id,
                           location, location_precision, status, verification_status)
select v.kind::public.place_kind, c.owner_id, v.slug, v.name, v.summary,
       'Fiche de démonstration fictive, destinée à tester la plateforme. Elle ne décrit aucun établissement réel.',
       (select id from public.categories where slug = v.category), c.city_id, v.neighborhood,
       pg_temp.demo_point(v.dlng, v.dlat), 'approximate', 'published', 'placeholder'
from demo_ctx c
cross join lateral (values
  ('etablissement', 'exemple-restaurant', 'Exemple — Restaurant (à valider localement)', 'Exemple de fiche restaurant.', 'restaurants-gastronomie', c.n_cite, 0.004, 0.002),
  ('etablissement', 'exemple-hebergement', 'Exemple — Hébergement (à valider localement)', 'Exemple de fiche hébergement.', 'hotels-hebergements', c.n_lac, -0.006, 0.005),
  ('etablissement', 'exemple-boutique', 'Exemple — Boutique (à valider localement)', 'Exemple de fiche commerce.', 'mode-beaute', c.n_cite, 0.002, -0.003),
  ('etablissement', 'exemple-artisan', 'Exemple — Artisan dépannage (à valider localement)', 'Exemple de fiche prestataire.', 'artisans-depannage', c.n_bardot, -0.010, -0.004),
  ('lieu_touristique', 'exemple-lieu-a-visiter', 'Exemple — Lieu à visiter (à valider localement)', 'Exemple de fiche touristique.', 'lieux-a-visiter', null, 0.012, 0.010)
) as v (kind, slug, name, summary, category, neighborhood, dlng, dlat)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Annonces (prix non communiqué, aucun contact)
-- -----------------------------------------------------------------------------
insert into public.listings (owner_id, slug, title, description, category_id, city_id, neighborhood_id,
                             location, location_precision, public_location_precision, status, verification_status,
                             availability_status, attributes, contact_name)
select c.owner_id, v.slug, v.title,
       'Annonce de démonstration fictive, destinée à tester la plateforme. Elle ne correspond à aucune offre réelle.',
       (select id from public.categories where slug = v.category), c.city_id, v.neighborhood,
       pg_temp.demo_point(v.dlng, v.dlat), 'approximate', 'neighborhood', 'published', 'placeholder',
       'unknown', v.attributes::jsonb, 'Compte de démonstration'
from demo_ctx c
cross join lateral (values
  ('exemple-logement-location', 'Exemple — Logement à louer (à valider localement)', 'immobilier-location', c.n_cite, 0.003, 0.001, '{"type_bien":"studio","meuble":true}'),
  ('exemple-offre-emploi', 'Exemple — Offre d’emploi (à valider localement)', 'offres-emploi', c.n_lac, -0.004, 0.003, '{"contrat":"cdd"}'),
  ('exemple-vehicule', 'Exemple — Véhicule d’occasion (à valider localement)', 'motos', c.n_bardot, -0.008, -0.002, '{}'),
  ('exemple-service', 'Exemple — Service à domicile (à valider localement)', 'beaute-bien-etre', c.n_cite, 0.001, -0.005, '{}')
) as v (slug, title, category, neighborhood, dlng, dlat, attributes)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Événement (date relative, sans lieu réel)
-- -----------------------------------------------------------------------------
insert into public.events (organizer_id, slug, title, description, category_id, city_id, starts_at, ends_at,
                           location, location_precision, status, verification_status, organizer_name)
select c.owner_id, 'exemple-evenement', 'Exemple — Événement culturel (à valider localement)',
       'Événement de démonstration fictif, destiné à tester la plateforme. Aucune manifestation réelle n’est annoncée.',
       (select id from public.categories where slug = 'culture-traditions'), c.city_id,
       date_trunc('day', now()) + interval '10 days 18 hours', date_trunc('day', now()) + interval '10 days 21 hours',
       pg_temp.demo_point(0.005, 0.006), 'approximate', 'published', 'placeholder', 'Organisateur de démonstration'
from demo_ctx c
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Article du guide (gabarit)
-- -----------------------------------------------------------------------------
insert into public.guide_articles (section_id, city_id, slug, title, summary, body, status, verification_status)
select (select id from public.guide_sections where slug = 'se-deplacer'), c.city_id, 'exemple-se-deplacer',
       'Exemple — Se déplacer à San Pedro (à rédiger)',
       'Gabarit d’article : à remplacer par un contenu rédigé et vérifié par l’équipe locale.',
       E'## Article de démonstration\n\nCe texte est un **gabarit**. Il ne contient aucune information réelle sur les transports de la ville.\n\nL’équipe locale y décrira les moyens de déplacement, avec leurs sources et la date de vérification.',
       'published', 'placeholder'
from demo_ctx c
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Fiches professionnelles (niveau 10) : aucun téléphone, horaire ni nom réel
-- -----------------------------------------------------------------------------
insert into public.business_profiles (owner_id, slug, name, description, category_id, city_id, neighborhood_id,
                                      location, location_precision, public_location_precision, status, verification_status,
                                      services, service_area, accepts_quotes)
select c.owner_id, v.slug, v.name,
       'Fiche de démonstration fictive, destinée à tester la plateforme. Elle ne décrit aucun professionnel réel.',
       (select id from public.categories where slug = v.category), c.city_id, v.neighborhood,
       pg_temp.demo_point(v.dlng, v.dlat), 'approximate', 'approximate', 'published', 'placeholder',
       v.services::text[], 'Exemple : zone à préciser par le professionnel', true
from demo_ctx c
cross join lateral (values
  ('exemple-electricien', 'Exemple — Électricien (à valider localement)', 'electricite', c.n_cite, 0.002, 0.003, '{"Exemple de prestation : dépannage","Exemple de prestation : installation"}'),
  ('exemple-climatisation', 'Exemple — Climatisation (à valider localement)', 'climatisation', c.n_lac, -0.003, 0.002, '{"Exemple de prestation : entretien","Exemple de prestation : réparation"}'),
  ('exemple-plombier', 'Exemple — Plombier (à valider localement)', 'plomberie', c.n_bardot, -0.006, -0.001, '{"Exemple de prestation : recherche de fuite"}')
) as v (slug, name, category, neighborhood, dlng, dlat, services)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Vitrines de commerces (niveau 11) : services et ambiance d'exemple, aucun
-- horaire (les vitrines affichent alors « horaires non renseignés »)
-- -----------------------------------------------------------------------------
insert into public.places (kind, created_by, slug, name, summary, description, category_id, city_id, neighborhood_id,
                           location, location_precision, status, verification_status)
select 'etablissement', c.owner_id, v.slug, v.name, v.summary,
       'Fiche de démonstration fictive, destinée à tester la plateforme. Elle ne décrit aucun commerce réel.',
       (select id from public.categories where slug = v.category), c.city_id, v.neighborhood,
       pg_temp.demo_point(v.dlng, v.dlat), 'approximate', 'published', 'placeholder'
from demo_ctx c
cross join lateral (values
  ('exemple-alimentation', 'Exemple — Alimentation (à valider localement)', 'Exemple de vitrine alimentaire.', 'alimentation', c.n_lac, 0.001, 0.004),
  ('exemple-quincaillerie', 'Exemple — Quincaillerie (à valider localement)', 'Exemple de vitrine de quincaillerie.', 'quincaillerie-materiaux', c.n_bardot, -0.004, -0.002)
) as v (slug, name, summary, category, neighborhood, dlng, dlat)
on conflict (slug) do nothing;

update public.places p set features = v.features::text[], ambiance = v.ambiance::text[], products = v.products::text[]
from (values
  ('exemple-restaurant', '{sur_place,a_emporter,paiement_mobile}', '{familiale,decontractee}', '{"Exemple de plat","Exemple de boisson"}'),
  ('exemple-boutique', '{paiement_mobile}', '{}', '{"Exemple d’article"}'),
  ('exemple-alimentation', '{livraison,paiement_mobile,parking}', '{}', '{"Exemple de produit frais","Exemple de produit d’épicerie"}'),
  ('exemple-quincaillerie', '{livraison}', '{}', '{"Exemple d’outillage","Exemple de matériau"}')
) as v (slug, features, ambiance, products)
where p.slug = v.slug and p.verification_status = 'placeholder';
