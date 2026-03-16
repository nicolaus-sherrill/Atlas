import { useState, useEffect, useRef, useCallback } from "react";
import type { WorkSpot, Category, TagId, CategoryScores, ScoreCategory } from "@/lib/types";
import { CATEGORIES, TAGS, SCORE_CATEGORIES, EMPTY_SCORES } from "@/lib/types";
import { reverseGeocode, forwardGeocode } from "@/lib/geocoding";

interface SpotFormProps {
  pendingLocation: { lat: number; lng: number } | null;
  geoData: { address: string; city: string } | null;
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onCancel: () => void;
}

export default function SpotForm({ pendingLocation, geoData, onSubmit, onCancel }: SpotFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [city, setCity] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [scores, setScores] = useState<CategoryScores>({ ...EMPTY_SCORES });
  const [selectedTags, setSelectedTags] = useState<Set<TagId>>(new Set());

  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeSeqRef = useRef<number>(0);

  useEffect(() => {
    if (!pendingLocation) return;
    if (geoData) return;
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

  useEffect(() => {
    if (geoData) {
      if (geoData.address) setAddress(geoData.address);
      if (geoData.city) setCity(geoData.city);
    }
  }, [geoData]);

  const setScore = (key: ScoreCategory, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTag = (tagId: TagId) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
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
      scores,
      tags: Array.from(selectedTags),
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

        <div className="form-row">
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
          <div className="form-group">
            <label>City</label>
            <div className="city-display">
              {cityLoading ? "Detecting..." : city || "Set location to detect"}
            </div>
          </div>
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

        <div className="form-group">
          <label>Rate this spot</label>
          <div className="score-categories">
            {SCORE_CATEGORIES.map((sc) => (
              <div key={sc.key} className="score-category-row">
                <span className="score-category-name">{sc.label}</span>
                <span className="score-dots-input">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`score-dot-char ${scores[sc.key] >= v ? "filled" : ""}`}
                      onClick={() => setScore(sc.key, v)}
                      title={`${v}/5`}
                    >
                      ●
                    </button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Tags</label>
          <div className="tag-chip-grid">
            {TAGS.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`tag-chip ${selectedTags.has(tag.id) ? "active" : ""}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.label}
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
