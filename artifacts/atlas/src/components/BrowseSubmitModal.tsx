import { useState } from "react";
import type { WorkSpot, Category, TagId, CategoryScores, ScoreCategory } from "@/lib/types";
import { CATEGORIES, TAG_CATEGORIES, EMPTY_SCORES } from "@/lib/types";

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
  const [scores, setScores] = useState<CategoryScores>({ ...EMPTY_SCORES });
  const [selectedTags, setSelectedTags] = useState<Set<TagId>>(new Set());

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

  const allTags = TAG_CATEGORIES.flatMap((g) => g.tags);

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
      scores,
      tags: Array.from(selectedTags),
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
            <label>Rate this spot</label>
            <div className="score-categories">
              {TAG_CATEGORIES.map((group) => (
                <div key={group.key} className="score-category-row">
                  <span className="score-category-name">{group.label}</span>
                  <div className="score-dots">
                    {[0, 1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`score-dot ${scores[group.key] >= v && v > 0 ? "filled" : ""} ${v === 0 && scores[group.key] === 0 ? "zero-active" : ""}`}
                        onClick={() => setScore(group.key, v)}
                        title={v === 0 ? "Not rated" : `${v}/5`}
                      >
                        {v === 0 ? "–" : v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <p className="form-hint-text">Select any that apply — tags refine your scores.</p>
            <div className="tag-grid">
              {allTags.map((tag) => (
                <label key={tag.id} className="tag-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTags.has(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  <span>{tag.label}</span>
                </label>
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
