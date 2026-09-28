import { useCallback, useRef, useState } from "react";
import type { PlaceRef } from "@/lib/geocode";
import { fetchPlaceDetails, type PlaceDetails } from "@/lib/osm";

export interface PlaceLink {
  place: PlaceRef;
  name: string;
  details: PlaceDetails | null;
  loading: boolean;
}

// Tracks the real place a contributor picked from search, and loads its OpenStreetMap details.
// onDetails runs once they arrive, so the form can pre-fill category and tags.
export function usePlaceLink(onDetails: (details: PlaceDetails) => void) {
  const [link, setLink] = useState<PlaceLink | null>(null);
  const seq = useRef(0);
  const onDetailsRef = useRef(onDetails);
  onDetailsRef.current = onDetails;

  const select = useCallback(async (place: PlaceRef, name: string) => {
    const mine = ++seq.current;
    setLink({ place, name, details: null, loading: true });
    const details = await fetchPlaceDetails(place).catch((): PlaceDetails => ({ suggestedTags: [] }));
    if (mine !== seq.current) return;
    setLink({ place, name, details, loading: false });
    onDetailsRef.current(details);
  }, []);

  const clear = useCallback(() => {
    seq.current++;
    setLink(null);
  }, []);

  return { link, select, clear };
}
