const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "AtlasWorkSpotFinder/1.0";
const MIN_REQUEST_INTERVAL = 1100;

let lastRequestTime = 0;

async function throttledFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
}

function extractCity(data: Record<string, unknown>): string {
  const address = data.address as Record<string, string> | undefined;
  if (!address) return "Unknown";
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    "Unknown"
  );
}

export interface GeocodingResult {
  city: string;
  lat?: number;
  lng?: number;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await throttledFetch(url);
    if (!res.ok) return { city: "Unknown" };
    const data = await res.json();
    return { city: extractCity(data) };
  } catch {
    return { city: "Unknown" };
  }
}

export async function forwardGeocode(address: string): Promise<GeocodingResult> {
  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(address)}&addressdetails=1&limit=1`;
    const res = await throttledFetch(url);
    if (!res.ok) return { city: "Unknown" };
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return { city: "Unknown" };
    const first = results[0];
    return {
      city: extractCity(first),
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
    };
  } catch {
    return { city: "Unknown" };
  }
}
