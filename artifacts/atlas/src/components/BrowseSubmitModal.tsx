import { useState } from "react";
import type { WorkSpot, Category, TagId, CategoryScores, ScoreCategory } from "@/lib/types";
import { CATEGORIES, TAGS, SCORE_CATEGORIES, EMPTY_SCORES } from "@/lib/types";

interface BrowseSubmitModalProps {
  onSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
  onClose: () => void;
}

export default function BrowseSubmitModal({ onSubmit, onClose }: BrowseSubmitModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("cafe");
  const [address, setAddress] = useState("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      category,
      city: "Unknown",
      address: address.trim() || "No address provided",
      lat: 0,
      lng: 0,
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

          <div className="form-group">
            <label>Rate this spot</label>
            <div className="score-categories">
              {SCORE_CATEGORIES.map((sc) => (
                <div key={sc.key} className="score-category-row">
                  <span className="score-category-name">{sc.label}</span>
                  <div className="score-dots">
                    {[0, 1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`score-dot ${scores[sc.key] >= v && v > 0 ? "filled" : ""} ${v === 0 && scores[sc.key] === 0 ? "zero-active" : ""}`}
                        onClick={() => setScore(sc.key, v)}
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

          <button type="submit" className="btn-submit" disabled={!name.trim()}>
            Submit Place
          </button>
        </form>
      </div>
    </div>
  );
}
