// Place and address search as the visitor types, backed by Photon (photon.komoot.io), a search
// service built on OpenStreetMap that permits search-as-you-type. Nominatim, the previous
// backend, forbids it in its usage policy.

import type { Category } from "./types";

const PHOTON = "https://photon.komoot.io";

// Austin, until the app knows where the visitor is looking
export const DEFAULT_BIAS = { lat: 30.27, lng: -97.74 };

export type OsmType = "node" | "way" | "relation";

export interface PlaceRef {
  osmType: OsmType;
  osmId: number;
}

export interface GeocodingResult {
  displayName: string;
  // The place's own name when the result is a business, library or park
  name?: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  category?: Category;
  place?: PlaceRef;
}

// Kinds of places a work spot can be. Photon includes a result only if it matches one of these.
const PLACE_TAGS = [
  "amenity:cafe",
  "amenity:library",
  "amenity:coworking_space",
  "office:coworking",
  "leisure:park",
  "amenity:restaurant",
  "amenity:bar",
  "amenity:pub",
  "amenity:fast_food",
  "amenity:community_centre",
  "amenity:arts_centre",
  "shop:books",
  "shop:coffee",
  "tourism:museum",
  "amenity:university",
  "amenity:college",
];

const OSM_TYPE: Record<string, OsmType> = { N: "node", W: "way", R: "relation" };

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function categoryFromOsm(key?: string, value?: string): Category | undefined {
  if (key === "amenity" && value === "cafe") return "cafe";
  if (key === "shop" && value === "coffee") return "cafe";
  if (key === "amenity" && value === "library") return "library";
  if ((key === "amenity" && value === "coworking_space") || (key === "office" && value === "coworking")) return "coworking";
  if (key === "leisure" && value === "park") return "park";
  return undefined;
}

function toResult(f: PhotonFeature, isPlace: boolean): GeocodingResult {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const city = p.city || p.town || p.village || p.district || "";
  const address = [street, city, [p.state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const osmType = p.osm_type ? OSM_TYPE[p.osm_type] : undefined;
  const hasName = isPlace && !!p.name;

  return {
    displayName: hasName ? `${p.name}, ${address}` : address || p.name || "",
    name: hasName ? p.name : undefined,
    lat,
    lng,
    address,
    city,
    category: hasName ? categoryFromOsm(p.osm_key, p.osm_value) : undefined,
    place: hasName && osmType && p.osm_id ? { osmType, osmId: p.osm_id } : undefined,
  };
}

// Search results are cached for the session, so retyping a query doesn't hit the service again
const cache = new Map<string, GeocodingResult[]>();

async function photonSearch(params: URLSearchParams, isPlace: boolean, signal?: AbortSignal): Promise<GeocodingResult[]> {
  const url = `${PHOTON}/api/?${params}`;
  // The same query can be read as places or as plain addresses, so the reading is part of the key
  const key = `${isPlace ? "place" : "address"} ${url}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data: { features?: PhotonFeature[] } = await res.json();
  const results = (data.features ?? []).map((f) => toResult(f, isPlace)).filter((r) => r.displayName);
  cache.set(key, results);
  return results;
}

function baseParams(query: string, near = DEFAULT_BIAS): URLSearchParams {
  return new URLSearchParams({
    q: query.trim(),
    limit: "6",
    lang: "en",
    lat: String(near.lat),
    lon: String(near.lng),
    zoom: "12",
    location_bias_scale: "0.1",
  });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// Photon ranks by text match first, so an exact-spelling match across the world can outrank the
// local place someone means. Keep Photon's order, but list places within 50 km first.
function nearbyFirst(results: GeocodingResult[], near: { lat: number; lng: number }): GeocodingResult[] {
  const isNear = (r: GeocodingResult) => distanceKm(r, near) <= 50;
  return [...results.filter(isNear), ...results.filter((r) => !isNear(r))];
}

export async function searchPlaces(query: string, signal?: AbortSignal, near = DEFAULT_BIAS): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];
  const params = baseParams(query, near);
  params.set("limit", "10");
  for (const tag of PLACE_TAGS) params.append("osm_tag", tag);
  return nearbyFirst(await photonSearch(params, true, signal), near).slice(0, 6);
}

// The shell's one search field: any place or address, with a named place keeping its name
export async function searchMap(query: string, signal?: AbortSignal, near = DEFAULT_BIAS): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];
  return nearbyFirst(await photonSearch(baseParams(query, near), true, signal), near);
}

export async function searchAddress(query: string, signal?: AbortSignal, near?: { lat: number; lng: number }): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];
  return photonSearch(baseParams(query, near), false, signal);
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ city: string; address: string }> {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`);
    if (!res.ok) return { city: "Unknown", address: "" };
    const data: { features?: PhotonFeature[] } = await res.json();
    const first = data.features?.[0];
    if (!first) return { city: "Unknown", address: "" };
    const r = toResult(first, false);
    return { city: r.city || "Unknown", address: r.address };
  } catch {
    return { city: "Unknown", address: "" };
  }
}
