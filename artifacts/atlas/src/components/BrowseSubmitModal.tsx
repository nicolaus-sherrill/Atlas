import { createPortal } from "react-dom";
import { useState } from "react";
import type { WorkSpot, Category, TagId, CategoryScores, ScoreCategory } from "@/lib/types";
import { CATEGORIES, TAGS, SCORE_CATEGORIES, EMPTY_SCORES } from "@/lib/types";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import type { GeocodingResult } from "@/lib/geocode";
import PlaceLinkCard from "@/components/PlaceLinkCard";
import { usePlaceLink } from "@/hooks/use-place-link";
import Icon from "./Icon";

interface BrowseSubmitModalProps {
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onClose: () => void;
}

export default function BrowseSubmitModal({ onSubmit, onClose }: BrowseSubmitModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [scores, setScores] = useState<CategoryScores>({ ...EMPTY_SCORES });
  const [selectedTags, setSelectedTags] = useState<Set<TagId>>(new Set());

  const { link, select, clear } = usePlaceLink((details) => {
    if (details.category) setCategory(details.category);
    if (details.suggestedTags.length) setSelectedTags((prev) => new Set([...prev, ...details.suggestedTags]));
  });

  const handleNameSelect = (result: GeocodingResult) => {
    setName(result.name ?? result.displayName);
    setAddress(result.address);
    setCity(result.city);
    setLocation({ lat: result.lat, lng: result.lng });
    if (result.category) setCategory(result.category);
    if (result.place) select(result.place, result.name ?? "");
    else clear();
  };

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


  const handleAddressSelect = (result: GeocodingResult) => {
    setAddress(result.address || result.displayName);
    setCity(result.city);
    setLocation({ lat: result.lat, lng: result.lng });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location) return;
    const details = link && !link.loading ? link.details : null;

    onSubmit({
      name: name.trim(),
      category,
      city: city || "Unknown",
      address: address.trim() || "No address provided",
      lat: location.lat,
      lng: location.lng,
      scores,
      tags: Array.from(selectedTags),
      description: description.trim(),
      operatingHours: details?.operatingHours,
      website: details?.website,
      osmType: link?.place.osmType,
      osmId: link?.place.osmId,
    });
  };

  return createPortal(
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
            <AddressAutocomplete
              id="browse-name"
              mode="place"
              value={name}
              onChange={setName}
              onSelect={handleNameSelect}
              placeholder="Start typing the place's name"
              autoFocus
            />
            {link && <PlaceLinkCard link={link} onClear={clear} />}
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
                  <Icon name={cat.icon} weight="bold" size={16} />
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
            <label htmlFor="browse-description">Notes (optional)</label>
            <textarea
              id="browse-description"
              placeholder="What makes this spot great for working?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {name.trim() && !location && (
            <p className="spot-form-hint-text">Pick the place from the suggestions, or choose an address, so Atlas knows where it is.</p>
          )}
          <button type="submit" className="btn-submit" disabled={!name.trim() || !location}>
            Submit Place
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
