-- Link three more starter spots to their OpenStreetMap places, checked 2026-10-14. In each case
-- OpenStreetMap's address differs from the starter row's, and OpenStreetMap is taken as right: the
-- address and pin move to it. Each update only touches a row that is still unlinked, so an edit
-- made since does not get overwritten.
-- Still unlinked, with no OpenStreetMap place under their names within 1.5 km: seeds 5, 7, 9 to 13.

update public.spots
  set osm_type = 'node', osm_id = 8070341202, lat = 30.2674513, lng = -97.7507931,
      address = '301 West Ave, Austin, TX 78701', website = coalesce(website, 'https://codependentatx.com/')
  where id = 'seed-1' and osm_id is null;

update public.spots
  set osm_type = 'way', osm_id = 383355029, lat = 30.2552355, lng = -97.7616893,
      address = '1105 S Lamar Blvd, Austin, TX 78704'
  where id = 'seed-4' and osm_id is null;

-- OpenStreetMap holds this place twice (nodes 7112908724 and 13296570109); the older node is used
update public.spots
  set osm_type = 'node', osm_id = 7112908724, lat = 30.2677245, lng = -97.6938995,
      address = '1023 Springdale Rd, Austin, TX 78721',
      website = coalesce(website, 'https://mediciroasting.com/pages/springdale-general')
  where id = 'seed-6' and osm_id is null;
