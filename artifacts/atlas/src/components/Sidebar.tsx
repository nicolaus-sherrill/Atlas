import { useState, useEffect } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, SCORE_CATEGORIES, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { spotsToGeoJSON, spotsToKML, downloadFile } from "@/lib/export";
import type { GeocodingResult } from "@/lib/geocode";
import { matchesQuery } from "@/lib/search";
import { fetchAllCrowdStatuses, getBusynessInfo, timeAgo, type CrowdStatus } from "@/lib/crowd";
import CrowdMark from "./CrowdMark";
import Icon from "./Icon";
import PlaceResults from "./PlaceResults";

interface SidebarProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  selectedSpotId: string | null;
  onAddClick: () => void;
  isFormOpen: boolean;
  // The shell's one search: it filters these spots, and places matching it list beneath them
  query: string;
  places: GeocodingResult[];
  placesLoading: boolean;
  onPickPlace: (place: GeocodingResult) => void;
  // Only passed for admins; everyone else gets no delete control
  onDeleteSpot?: (id: string) => void;
  onChatOpen: () => void;
}

export default function Sidebar({ spots, onSpotSelect, selectedSpotId, onAddClick, isFormOpen, query, places, placesLoading, onPickPlace, onDeleteSpot, onChatOpen }: SidebarProps) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [crowdStatuses, setCrowdStatuses] = useState<Record<string, CrowdStatus>>({});

  useEffect(() => {
    fetchAllCrowdStatuses().then(setCrowdStatuses);
  }, []);
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
          {isFormOpen ? "Cancel" : "+ Add a Spot"}
        </button>
        <button className="btn-secondary" onClick={() => setShowExport(!showExport)}>
          Export
        </button>
      </div>

      <button className="btn-plan-day sidebar-plan-day" onClick={onChatOpen}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Plan my day
      </button>

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
          const score = calcScore(spot.scores, spot.tags);
          const tags = getSpotDisplayTags(spot).slice(0, 4);
          return (
            <div
              key={spot.id}
              role="button"
              tabIndex={0}
              data-spot-id={spot.id}
              className={`spot-card ${selectedSpotId === spot.id ? "selected" : ""}`}
              onClick={() => onSpotSelect(spot.id)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onSpotSelect(spot.id); } }}
            >
              <div className="spot-card-header">
                {cat && <Icon name={cat.icon} size={20} className="spot-card-icon" />}
                <div className="spot-card-info">
                  <span className="spot-card-name">{spot.name}</span>
                  <span className="spot-card-category">{cat?.label} &middot; {spot.city}</span>
                </div>
                <div className="spot-card-score-block">
                  <span className="spot-card-rating">{score.toFixed(1)}</span>
                  {spot.ratingCount !== undefined && (
                    <span className="spot-card-rating-count">
                      {spot.ratingCount === 1 ? "1 rating" : `${spot.ratingCount} ratings`}
                    </span>
                  )}
                </div>
              </div>
              <div className="spot-card-address">{spot.address}</div>
              {spot.operatingHours && (() => {
                const openNow = isOpenNow(spot.operatingHours);
                return (
                  <div className={`spot-card-hours ${openNow ? "open" : "closed"}`}>
                    <span className="hours-dot" aria-hidden="true" />
                    <span className="hours-state">{openNow ? "Open" : "Closed"}</span>
                    <span className="spot-card-hours-today">{getTodayHoursLabel(spot.operatingHours)}</span>
                  </div>
                );
              })()}
              {crowdStatuses[spot.id] && (() => {
                const cs = crowdStatuses[spot.id];
                const info = getBusynessInfo(cs.level);
                return (
                  <div className="spot-card-crowd">
                    <CrowdMark level={info.level} />
                    <span>{info.label}</span>
                    <span className="crowd-time">{timeAgo(cs.lastReportedAt)}</span>
                  </div>
                );
              })()}
              {spot.aiSummary && (
                <div className="spot-card-summary">{spot.aiSummary}</div>
              )}
              <div className="spot-card-tags">
                {tags.map((t) => (
                  <span key={t} className="spot-card-tag">{t}</span>
                ))}
                {getSpotDisplayTags(spot).length > 4 && (
                  <span className="spot-card-tag">+{getSpotDisplayTags(spot).length - 4}</span>
                )}
              </div>
              {onDeleteSpot && (confirmDeleteId === spot.id ? (
                <div className="spot-card-delete-confirm" onClick={(e) => e.stopPropagation()}>
                  <span>Delete this spot?</span>
                  <button
                    className="spot-card-delete-yes"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSpot(spot.id);
                      setConfirmDeleteId(null);
                    }}
                  >
                    Yes, delete
                  </button>
                  <button
                    className="spot-card-delete-no"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="spot-card-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(spot.id);
                  }}
                  title="Delete spot"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              ))}
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
