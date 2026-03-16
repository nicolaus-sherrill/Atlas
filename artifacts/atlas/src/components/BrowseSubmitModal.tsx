import { useState } from "react";
import type { WorkSpot, Category, TagId, CategoryScores, ScoreCategory, OperatingHours, DayOfWeek } from "@/lib/types";
import { CATEGORIES, TAGS, SCORE_CATEGORIES, EMPTY_SCORES, DEFAULT_OPERATING_HOURS, DAYS_OF_WEEK, DAY_LABELS_FULL } from "@/lib/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { GeocodingResult } from "@/lib/geocode";

interface BrowseSubmitModalProps {
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onClose: () => void;
}

export default function BrowseSubmitModal({ onSubmit, onClose }: BrowseSubmitModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [description, setDescription] = useState("");
  const [scores, setScores] = useState<CategoryScores>({ ...EMPTY_SCORES });
  const [selectedTags, setSelectedTags] = useState<Set<TagId>>(new Set());
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(JSON.parse(JSON.stringify(DEFAULT_OPERATING_HOURS)));

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

  const updateDayHours = (day: DayOfWeek, field: "open" | "close" | "closed", value: string | boolean) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleAddressSelect = (result: GeocodingResult) => {
    setAddress(result.displayName);
    setCity(result.city);
    setLat(result.lat);
    setLng(result.lng);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      category,
      city: city || "Unknown",
      address: address.trim() || "No address provided",
      lat,
      lng,
      scores,
      tags: Array.from(selectedTags),
      description: description.trim(),
      operatingHours,
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
            <label htmlFor="browse-address">Address</label>
            <AddressAutocomplete
              id="browse-address"
              value={address}
              onChange={setAddress}
              onSelect={handleAddressSelect}
              placeholder="123 Main St, Austin, TX"
            />
          </div>

          {city && (
            <div className="form-group">
              <label>City</label>
              <div className="city-display">{city}</div>
            </div>
          )}

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
            <label>Operating Hours</label>
            <div className="operating-hours-grid">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="operating-hours-row">
                  <span className="operating-hours-day">{DAY_LABELS_FULL[day]}</span>
                  <label className="operating-hours-closed-toggle">
                    <input
                      type="checkbox"
                      checked={operatingHours[day].closed}
                      onChange={(e) => updateDayHours(day, "closed", e.target.checked)}
                    />
                    Closed
                  </label>
                  {!operatingHours[day].closed && (
                    <div className="operating-hours-times">
                      <input
                        type="time"
                        value={operatingHours[day].open}
                        onChange={(e) => updateDayHours(day, "open", e.target.value)}
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={operatingHours[day].close}
                        onChange={(e) => updateDayHours(day, "close", e.target.value)}
                      />
                    </div>
                  )}
                </div>
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
