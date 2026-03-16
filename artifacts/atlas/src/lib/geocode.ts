export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    addressdetails: "1",
    limit: "5",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "Accept-Language": "en",
      },
      signal,
    }
  );

  if (!response.ok) return [];

  const data: NominatimResult[] = await response.json();

  return data.map((item) => {
    const addr = item.address;
    const street = addr
      ? [addr.house_number, addr.road].filter(Boolean).join(" ")
      : "";
    const city =
      addr?.city || addr?.town || addr?.village || addr?.hamlet || addr?.suburb || "";

    return {
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: street,
      city,
    };
  });
}
