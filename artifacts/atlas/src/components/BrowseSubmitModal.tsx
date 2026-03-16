import { useState } from "react";
import type { WorkSpot, Category, TransitAccess } from "@/lib/types";
import { CATEGORIES, RATING_LABELS, TRANSIT_LABELS } from "@/lib/types";

interface BrowseSubmitModalProps {
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onClose: () => void;
}

export default function BrowseSubmitModal({ onSubmit, onClose }: BrowseSubmitModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
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

  const updateRating = (key: keyof typeof ratings, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTransit = (key: keyof TransitAccess) => {
    setTransit((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const lat = latStr.trim() ? parseFloat(latStr) : 0;
    const lng = lngStr.trim() ? parseFloat(lngStr) : 0;

    onSubmit({
      name: name.trim(),
      category,
      city: "Unknown",
      address: address.trim() || "No address provided",
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng,
      ratings,
      food,
      drink,
      ada,
      transit,
      description: description.trim(),
    });
  };

  return (
    <div className="browse-modal-backdrop" onClick={onClose}>
      <div className="browse-modal" onClick={(e) => e.stopPropagation()}>
        <form className="spot-form" onSubmit={handleSubmit}>
          <div className="spot-form-header">
            <h2>Submit a Place</h2>
            <button type="button" className="spot-form-close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="browse-name">Name</label>
            <input
              id="browse-name"
              type="text"
              placeholder="e.g. The Daily Grind"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="browse-category">Category</label>
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
            <label htmlFor="browse-address">Address</label>
            <input
              id="browse-address"
              type="text"
              placeholder="123 Main St, Austin, TX"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="browse-lat">Latitude (optional)</label>
              <input
                id="browse-lat"
                type="text"
                placeholder="e.g. 30.2672"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="browse-lng">Longitude (optional)</label>
              <input
                id="browse-lng"
                type="text"
                placeholder="e.g. -97.7431"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
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
            <label htmlFor="browse-description">Notes (optional)</label>
            <textarea
              id="browse-description"
              placeholder="What makes this spot great for working?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <button type="submit" className="btn-submit" disabled={!name.trim()}>
            Submit Place
          </button>
        </form>
      </div>
    </div>
  );
}
