import { useState, useEffect, useRef, useCallback } from "react";
import type { WorkSpot, Category, TransitAccess } from "@/lib/types";
import { CATEGORIES, RATING_LABELS, TRANSIT_LABELS } from "@/lib/types";
import { reverseGeocode, forwardGeocode } from "@/lib/geocoding";

interface SpotFormProps {
  pendingLocation: { lat: number; lng: number } | null;
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onCancel: () => void;
}

export default function SpotForm({ pendingLocation, onSubmit, onCancel }: SpotFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [city, setCity] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [ratings, setRatings] = useState<WorkSpot["ratings"]>({
    wifi: 3, power: 3, noise: 3, coffee: 3, lighting: 3, seating: 3, outlets: 3,
  });
  const [food, setFood] = useState(false);
  const [drink, setDrink] = useState(false);
  const [ada, setAda] = useState(false);
  const [transit, setTransit] = useState<TransitAccess>({
    walking: false, biking: false, driving: false, train: false, bus: false,
  });

  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeSeqRef = useRef<number>(0);

  useEffect(() => {
    if (!pendingLocation) return;
    const seq = ++geocodeSeqRef.current;
    setCityLoading(true);
    reverseGeocode(pendingLocation.lat, pendingLocation.lng).then((result) => {
      if (seq === geocodeSeqRef.current) {
        setCity(result.city);
        setCityLoading(false);
      }
    });
  }, [pendingLocation?.lat, pendingLocation?.lng]);

  const handleAddressChange = useCallback((value: string) => {
    setAddress(value);
    if (addressDebounceRef.current) {
      clearTimeout(addressDebounceRef.current);
    }
    if (!value.trim() || value.trim().length < 5) return;
    addressDebounceRef.current = setTimeout(() => {
      const seq = ++geocodeSeqRef.current;
      setCityLoading(true);
      forwardGeocode(value.trim()).then((result) => {
        if (seq === geocodeSeqRef.current) {
          setCity(result.city);
          setCityLoading(false);
        }
      });
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) {
        clearTimeout(addressDebounceRef.current);
      }
    };
  }, []);

  const updateRating = (key: keyof typeof ratings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTransit = (key: keyof TransitAccess) => {
    setTransit((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !pendingLocation) return;

    onSubmit({
      name: name.trim(),
      category,
      city: city || "Unknown",
      address: address.trim() || `${pendingLocation.lat.toFixed(4)}, ${pendingLocation.lng.toFixed(4)}`,
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      ratings,
      food,
      drink,
      ada,
      transit,
      description: description.trim(),
    });
  };

  return (
    <div className="spot-form-overlay">
      <form className="spot-form" onSubmit={handleSubmit}>
        <div className="spot-form-header">
          <h2>Add a Spot</h2>
          <button type="button" className="spot-form-close" onClick={onCancel}>
            &times;
          </button>
        </div>

        {!pendingLocation && (
          <div className="spot-form-hint">
            <span>📍</span>
            <p>Click anywhere on the map to set the location</p>
          </div>
        )}

        {pendingLocation && (
          <div className="spot-form-location">
            <span>📍</span>
            <span>{pendingLocation.lat.toFixed(5)}, {pendingLocation.lng.toFixed(5)}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            placeholder="e.g. The Daily Grind"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <div className="category-select">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={`category-option ${category === cat.value ? "active" : ""}`}
                onClick={() => setCategory(cat.value)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>City</label>
            <div className="city-display">
              {cityLoading ? "Detecting..." : city || "Set location to detect"}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              type="text"
              placeholder="123 Main St"
              value={address}
              onChange={(e) => handleAddressChange(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Ratings</label>
          <div className="ratings-grid">
            {(Object.keys(ratings) as (keyof typeof ratings)[]).map((key) => (
              <div key={key} className="rating-row">
                <span className="rating-row-label">{RATING_LABELS[key]}</span>
                <div className="rating-row-dots">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      className={`rating-button ${i <= ratings[key] ? "filled" : ""}`}
                      onClick={() => updateRating(key, i)}
                    >
                      ●
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Amenities</label>
          <div className="amenities-row">
            <button
              type="button"
              className={`amenity-toggle ${food ? "active" : ""}`}
              onClick={() => setFood(!food)}
            >
              🍽️ Food
            </button>
            <button
              type="button"
              className={`amenity-toggle ${drink ? "active" : ""}`}
              onClick={() => setDrink(!drink)}
            >
              🥤 Drinks
            </button>
            <button
              type="button"
              className={`amenity-toggle ${ada ? "active" : ""}`}
              onClick={() => setAda(!ada)}
            >
              ♿ ADA
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Transit Access</label>
          <div className="transit-row">
            {(Object.keys(transit) as (keyof TransitAccess)[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`transit-toggle ${transit[key] ? "active" : ""}`}
                onClick={() => toggleTransit(key)}
              >
                {TRANSIT_LABELS[key].icon} {TRANSIT_LABELS[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Notes (optional)</label>
          <textarea
            id="description"
            placeholder="What makes this spot great for working?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <button type="submit" className="btn-submit" disabled={!name.trim() || !pendingLocation}>
          Add Spot
        </button>
      </form>
    </div>
  );
}
