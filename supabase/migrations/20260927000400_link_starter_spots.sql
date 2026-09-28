-- Link starter spots to their OpenStreetMap places, so the same place can't be added twice and its
-- details can be refreshed later. Only spots whose name and street address both match
-- OpenStreetMap are linked; their pins move to OpenStreetMap's location, since the starter
-- coordinates were approximate (Mozart's sat about 730 m from the building).
-- Not linked, pending review: seed-1 and seed-4 (street numbers disagree), and seeds 5, 6, 7, 9 to
-- 13 (no confident match).

update public.spots set osm_type = 'way', osm_id = 31054328, lat = 30.2954311, lng = -97.784238
  where id = 'seed-2';
update public.spots set osm_type = 'node', osm_id = 10555261227, lat = 30.2477249, lng = -97.7497778
  where id = 'seed-3';
update public.spots set osm_type = 'way', osm_id = 516271467, lat = 30.2660164, lng = -97.7517064,
  website = coalesce(website, 'https://library.austintexas.gov/')
  where id = 'seed-8';
