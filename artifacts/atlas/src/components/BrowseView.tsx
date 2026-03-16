import { useState, useMemo, Fragment } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, computeWorkabilityScore, getSpotTags } from "@/lib/types";
import BrowseSubmitModal from "./BrowseSubmitModal";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface BrowseViewProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  onAddClick: () => void;
  onBrowseSubmit: (spot: Omit<WorkSpot, "id" | "submittedAt">) => void;
}

const ALL_FILTER_TAGS = [
  "Food", "Drinks", "ADA", "Fast WiFi", "Many Outlets",
  "Good Lighting", "Great Seating", "Walking", "Biking",
  "Driving", "Train", "Bus",
];

export default function BrowseView({ spots, onSpotSelect, onAddClick, onBrowseSubmit }: BrowseViewProps) {
  const [search, setSearch] = useState("");
  const [activeCities, setActiveCities] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const cities = useMemo(() => {
    const set = new Set(spots.map((s) => s.city));
    return Array.from(set).sort();
  }, [spots]);

  const filtered = useMemo(() => {
    return spots.filter((spot) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        spot.name.toLowerCase().includes(q) ||
        spot.address.toLowerCase().includes(q) ||
        spot.city.toLowerCase().includes(q) ||
        spot.description.toLowerCase().includes(q);
      const matchesCity = activeCities.size === 0 || activeCities.has(spot.city);
      const matchesCategory = !activeCategory || spot.category === activeCategory;
      const spotTags = getSpotTags(spot);
      const matchesTags = activeTags.size === 0 || Array.from(activeTags).every((t) => spotTags.includes(t));
      return matchesSearch && matchesCity && matchesCategory && matchesTags;
    });
  }, [spots, search, activeCities, activeCategory, activeTags]);

  const toggleCity = (city: string) => {
    setActiveCities((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="browse-view">
      <header className="browse-header">
        <div className="browse-header-left">
          <div className="browse-brand">
            <svg width="32" height="32" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="#1A1A18" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z"/>
              <circle cx="28.725" cy="67.275" r="28.725" fill="#1A1A18"/>
            </svg>
            <h1>Atlas</h1>
          </div>
          <p className="browse-tagline">Community-powered spots for remote work, handpicked by the internet.</p>
        </div>
        <button className="btn-submit-place" onClick={() => setShowSubmitModal(true)}>
          Submit a place
        </button>
      </header>

      <div className="browse-filters">
        <div className="browse-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search spots..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="browse-chips-section">
        <MultiSelectDropdown
          label="City"
          options={cities}
          selected={activeCities}
          onToggle={toggleCity}
        />

        <div className="browse-chip-row">
          <button
            className={`browse-chip ${activeCategory === null ? "active" : ""}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              className={`browse-chip ${activeCategory === cat.value ? "active" : ""}`}
              onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        <MultiSelectDropdown
          label="Tags"
          options={ALL_FILTER_TAGS}
          selected={activeTags}
          onToggle={toggleTag}
          formatTrigger={(sel) =>
            sel.size === 0
              ? "Tags ▾"
              : sel.size <= 2
                ? `${Array.from(sel).join(", ")} ▾`
                : `${sel.size} tags ▾`
          }
        />
      </div>

      <div className="browse-table-wrapper">
        <table className="browse-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-name">Spot</th>
              <th className="col-city">City</th>
              <th className="col-category">Type</th>
              <th className="col-tags">Tags</th>
              <th className="col-score">Score</th>
              <th className="col-map">Map</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((spot, i) => {
              const cat = CATEGORIES.find((c) => c.value === spot.category);
              const score = computeWorkabilityScore(spot);
              const tags = getSpotTags(spot).slice(0, 3);
              const isExpanded = expandedId === spot.id;
              return (
                <Fragment key={spot.id}>
                  <tr
                    className={`browse-row ${isExpanded ? "expanded" : ""}`}
                    onClick={() => setExpandedId(isExpanded ? null : spot.id)}
                  >
                    <td className="col-num">{String(i + 1).padStart(2, "0")}</td>
                    <td className="col-name">{spot.name}</td>
                    <td className="col-city">{spot.city}</td>
                    <td className="col-category">
                      <span className="browse-category-badge">{cat?.icon} {cat?.label}</span>
                    </td>
                    <td className="col-tags">
                      <div className="browse-tag-pills">
                        {tags.map((t) => (
                          <span key={t} className="browse-tag-pill">{t}</span>
                        ))}
                        {getSpotTags(spot).length > 3 && (
                          <span className="browse-tag-pill more">+{getSpotTags(spot).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="col-score">
                      <span className="browse-score">{score.toFixed(1)}</span>
                    </td>
                    <td className="col-map">
                      <button
                        className="browse-map-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSpotSelect(spot.id);
                        }}
                      >
                        {spot.lat.toFixed(4)},{spot.lng.toFixed(4)}
                      </button>
                      <span className="browse-arrow">&rarr;</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="browse-detail-row">
                      <td colSpan={7}>
                        <div className="browse-detail">
                          <div className="browse-detail-main">
                            {spot.aiSummary && (
                              <p className="browse-detail-summary">{spot.aiSummary}</p>
                            )}
                            {spot.description && !spot.aiSummary && (
                              <p className="browse-detail-desc">{spot.description}</p>
                            )}
                            {spot.description && spot.aiSummary && (
                              <p className="browse-detail-desc">{spot.description}</p>
                            )}
                          </div>
                          <div className="browse-detail-meta">
                            <div className="browse-detail-ratings">
                              {(Object.keys(spot.ratings) as (keyof typeof spot.ratings)[]).map((key) => (
                                <div key={key} className="browse-detail-rating">
                                  <span className="browse-detail-rating-label">
                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                  </span>
                                  <span className="browse-detail-rating-dots">
                                    {[1,2,3,4,5].map((v) => (
                                      <span key={v} className={`rdot ${v <= spot.ratings[key] ? "filled" : ""}`} />
                                    ))}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="browse-detail-tags">
                              {getSpotTags(spot).map((t) => (
                                <span key={t} className="browse-tag-pill">{t}</span>
                              ))}
                            </div>
                          </div>
                          <button
                            className="browse-detail-map-btn"
                            onClick={() => onSpotSelect(spot.id)}
                          >
                            View on Map &rarr;
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="browse-empty">
            <p>No spots match your filters.</p>
            <p>Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {showSubmitModal && (
        <BrowseSubmitModal
          onSubmit={(spot) => {
            onBrowseSubmit(spot);
            setShowSubmitModal(false);
          }}
          onClose={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
