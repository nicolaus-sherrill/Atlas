-- Link three more live spots to their OpenStreetMap places, checked 2026-10-15 against the live
-- rows. Each address already matches OpenStreetMap, so only the link and the pin change; Atlas keeps
-- its own names. Each update only touches a row that is still unlinked.
-- Still unlinked, with no OpenStreetMap place at their addresses: Desnudo Coffee (South Lamar),
-- Kyoko Coffee and Mutual Friends Coffee (Marfa).

update public.spots
  set osm_type = 'node', osm_id = 13822250755, lat = 30.259523, lng = -97.738635
  where id = 'seed-11' and osm_id is null;

update public.spots
  set osm_type = 'way', osm_id = 1234099095, lat = 30.307073, lng = -97.729857
  where id = 'seed-7' and osm_id is null;

update public.spots
  set osm_type = 'node', osm_id = 14269246001, lat = 30.253657, lng = -97.714230
  where id = 'seed-5' and osm_id is null;
