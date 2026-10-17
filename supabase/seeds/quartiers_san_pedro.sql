-- =============================================================================
-- Quartiers de San Pedro — LISTE INITIALE À VALIDER
--
-- Noms de quartiers couramment cités, saisis SANS coordonnées. Cette liste
-- doit être vérifiée et complétée par une personne connaissant la ville
-- (orthographe, découpage, quartiers manquants) avant le lancement public.
-- Les corrections se font ensuite depuis l'administration.
-- À exécuter après seed.sql.
-- =============================================================================
insert into public.neighborhoods (city_id, slug, name)
select c.id, q.slug, q.name
from public.cities c
cross join (values
  ('bardot', 'Bardot'),
  ('balmer', 'Balmer'),
  ('cite', 'Cité'),
  ('lac', 'Lac'),
  ('seweke', 'Séwéké'),
  ('zimbabwe', 'Zimbabwe'),
  ('victor-ballot', 'Victor Ballot'),
  ('poro', 'Poro'),
  ('zone-industrielle', 'Zone industrielle'),
  ('zone-portuaire', 'Zone portuaire')
) as q (slug, name)
where c.slug = 'san-pedro'
on conflict (city_id, slug) do nothing;
