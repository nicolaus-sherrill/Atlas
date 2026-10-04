import { useEffect, useState } from "react";
import { searchMap, type GeocodingResult } from "@/lib/geocode";

// Places matching the search, fetched once typing pauses. Photon needs three characters.
export function usePlaceSearch(query: string) {
  const [places, setPlaces] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    setPlaces([]);
    if (q.length < 3) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchMap(q, controller.signal);
        if (!controller.signal.aborted) setPlaces(results);
      } catch {
        // an aborted or failed search leaves the list empty
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { places, loading };
}
