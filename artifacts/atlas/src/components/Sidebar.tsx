import { useState } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, RATING_LABELS, computeWorkabilityScore, getSpotTags } from "@/lib/types";
import { spotsToGeoJSON, spotsToKML, downloadFile } from "@/lib/export";

interface SidebarProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  selectedSpotId: string | null;
  onAddClick: () => void;
  isFormOpen: boolean;
  onClose: () => void;
  onBackToBrowse: () => void;
}

export default function Sidebar({ spots, onSpotSelect, selectedSpotId, onAddClick, isFormOpen, onClose, onBackToBrowse }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [showExport, setShowExport] = useState(false);

  const filtered = spots.filter((spot) => {
    const matchesSearch =
      !search ||
      spot.name.toLowerCase().includes(search.toLowerCase()) ||
      spot.address.toLowerCase().includes(search.toLowerCase()) ||
      spot.city.toLowerCase().includes(search.toLowerCase()) ||
      spot.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || spot.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#1A1A18" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z"/>
            <circle cx="28.725" cy="67.275" r="28.725" fill="#1A1A18"/>
          </svg>
          <h1>Atlas</h1>
          <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">&#9664;</button>
        </div>
        <p className="sidebar-tagline">Find your next great work spot</p>
        <button className="browse-back-btn" onClick={onBackToBrowse}>
          &#8592; Browse all spots
        </button>
      </div>

      <div className="sidebar-search">
        <input
          type="search"
          placeholder="Search spots..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sidebar-categories">
        <button
          className={`category-chip ${activeCategory === null ? "active" : ""}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            className={`category-chip ${activeCategory === cat.value ? "active" : ""}`}
            onClick={() => setActiveCategory(activeCategory === cat.value ? null : cat.value)}
          >
            <span>{cat.icon}</span> {cat.label}
          </button>
        ))}
      </div>

      <div className="sidebar-actions">
        <button className="btn-primary" onClick={onAddClick}>
          {isFormOpen ? "Cancel" : "+ Add a Spot"}
        </button>
        <button className="btn-secondary" onClick={() => setShowExport(!showExport)}>
          Export
        </button>
      </div>

      {showExport && (
        <div className="export-panel">
          <p>Export your spots to use in other map apps:</p>
          <div className="export-buttons">
            <button
              onClick={() => {
                downloadFile(spotsToGeoJSON(filtered), "atlas-spots.geojson", "application/geo+json");
                setShowExport(false);
              }}
            >
              GeoJSON
            </button>
            <button
              onClick={() => {
                downloadFile(spotsToKML(filtered), "atlas-spots.kml", "application/vnd.google-earth.kml+xml");
                setShowExport(false);
              }}
            >
              KML (Google Earth)
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-count">
        {filtered.length} spot{filtered.length !== 1 ? "s" : ""}
      </div>

      <div className="sidebar-list">
        {filtered.map((spot) => {
          const cat = CATEGORIES.find((c) => c.value === spot.category);
          const score = computeWorkabilityScore(spot);
          const tags = getSpotTags(spot).slice(0, 4);
          return (
            <button
              key={spot.id}
              className={`spot-card ${selectedSpotId === spot.id ? "selected" : ""}`}
              onClick={() => onSpotSelect(spot.id)}
            >
              <div className="spot-card-header">
                <span className="spot-card-icon">{cat?.icon}</span>
                <div className="spot-card-info">
                  <span className="spot-card-name">{spot.name}</span>
                  <span className="spot-card-category">{cat?.label} &middot; {spot.city}</span>
                </div>
                <span className="spot-card-rating">{score.toFixed(1)}</span>
              </div>
              <div className="spot-card-address">{spot.address}</div>
              {spot.aiSummary && (
                <div className="spot-card-summary">{spot.aiSummary}</div>
              )}
              <div className="spot-card-tags">
                {tags.map((t) => (
                  <span key={t} className="spot-card-tag">{t}</span>
                ))}
              </div>
              <div className="spot-card-ratings">
                {(["wifi", "power", "noise", "coffee", "lighting", "seating", "outlets"] as (keyof WorkSpot["ratings"])[]).map((key) => (
                  <div key={key} className="spot-card-rating-item">
                    <span className="rating-label">{RATING_LABELS[key]}</span>
                    <div className="rating-dots">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={`rating-dot ${i <= spot.ratings[key] ? "filled" : ""}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            <p>No spots found.</p>
            <p>Try a different search or add a new spot!</p>
          </div>
        )}
      </div>
    </aside>
  );
}
