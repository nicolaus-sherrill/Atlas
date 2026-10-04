import type { GeocodingResult } from "@/lib/geocode";
import Icon from "./Icon";

interface PlaceResultsProps {
  places: GeocodingResult[];
  loading: boolean;
  onPick: (place: GeocodingResult) => void;
}

// Places matching the search, listed under the spots. Picking one moves the map there.
export default function PlaceResults({ places, loading, onPick }: PlaceResultsProps) {
  if (!loading && places.length === 0) return null;
  return (
    <section className="place-results" aria-label="Places">
      <h2 className="place-results-heading">Places</h2>
      {loading && places.length === 0 ? (
        <p className="place-results-status" role="status">Searching places…</p>
      ) : (
        <>
          {places.map((p, i) => (
            <button key={`${p.lat},${p.lng},${i}`} type="button" className="place-result" onClick={() => onPick(p)}>
              <Icon name="map-pin" weight="bold" size={16} />
              <span className="place-result-text">
                <span className="place-result-name">{p.name ?? p.displayName}</span>
                {p.name && p.address && <span className="place-result-meta">{p.address}</span>}
              </span>
            </button>
          ))}
          <p className="place-results-credit">Search by Photon, data © OpenStreetMap contributors</p>
        </>
      )}
    </section>
  );
}
