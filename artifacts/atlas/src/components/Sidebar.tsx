import { useState } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { spotsToGeoJSON, spotsToKML, downloadFile } from "@/lib/export";
import type { GeocodingResult } from "@/lib/geocode";
import { matchesQuery } from "@/lib/search";
import Icon from "./Icon";
import PlaceResults from "./PlaceResults";

interface SidebarProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  selectedSpotId: string | null;
  onAddClick: () => void;
  // The shell's one search: it filters these spots, and places matching it list beneath them
  query: string;
  places: GeocodingResult[];
  placesLoading: boolean;
  onPickPlace: (place: GeocodingResult) => void;
}

export default function Sidebar({ spots, onSpotSelect, selectedSpotId, onAddClick, query, places, placesLoading, onPickPlace }: SidebarProps) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [showExport, setShowExport] = useState(false);
  const filtered = spots.filter((spot) => {
    const matchesCategory = !activeCategory || spot.category === activeCategory;
    return matchesCategory && matchesQuery(spot, query);
  });

  return (
    <aside className="sidebar">
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
            <Icon name={cat.icon} weight="bold" size={14} /> {cat.label}
          </button>
        ))}
      </div>

      <div className="sidebar-actions">
        <button className="btn-primary sidebar-add" onClick={onAddClick}>
          + Add a spot
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
        {/* Hairline two-line rows: the index, the name, then type and today's hours, with the score
            and a → on the right. Everything else is in the details the row opens */}
        {filtered.map((spot, i) => {
          const cat = CATEGORIES.find((c) => c.value === spot.category);
          const open = spot.operatingHours ? isOpenNow(spot.operatingHours) : null;
          const selected = selectedSpotId === spot.id;
          return (
            <div
              key={spot.id}
              role="button"
              tabIndex={0}
              data-spot-id={spot.id}
              aria-current={selected || undefined}
              className={`list-row${selected ? " selected" : ""}`}
              onClick={() => onSpotSelect(spot.id)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                  e.preventDefault();
                  onSpotSelect(spot.id);
                }
              }}
            >
              <span className="list-row-ix">{String(i + 1).padStart(2, "0")}</span>
              <span className="list-row-name">{spot.name}</span>
              <span className={`list-row-meta details-hours ${open ? "open" : "closed"}`}>
                <span>{cat?.label ?? spot.category}</span>
                {spot.operatingHours && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="hours-dot" aria-hidden="true" />
                    <span className="details-hours-state">{open ? "Open" : "Closed"}</span>
                    <span>{getTodayHoursLabel(spot.operatingHours)}</span>
                  </>
                )}
              </span>
              <span className="list-row-end">
                <span className="details-score">{calcScore(spot.scores, spot.tags).toFixed(1)}</span>
                <Icon name="arrow-right" weight="bold" size={16} />
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            <p>No spots found.</p>
            <p>Try a different search or add a new spot!</p>
          </div>
        )}
        <PlaceResults places={places} loading={placesLoading} onPick={onPickPlace} />
        <p className="sidebar-licence">
          Spot data is open under the{" "}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
            Open Database License
          </a>
          .
        </p>
      </div>
    </aside>
  );
}
