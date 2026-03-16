import { useState, useRef, useEffect, useCallback } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, scoreToLabel, SCORE_CATEGORIES } from "@/lib/types";
import ScoreDots from "./ScoreDots";
import { spotsToGeoJSON, spotsToKML, downloadFile } from "@/lib/export";
import { searchAddress, type GeocodingResult } from "@/lib/geocode";
import { fetchAllCrowdStatuses, getBusynessInfo, timeAgo, type CrowdStatus } from "@/lib/crowd";

interface SidebarProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  selectedSpotId: string | null;
  onAddClick: () => void;
  isFormOpen: boolean;
  onGeocode: (lat: number, lng: number, address: string, city: string) => void;
}

export default function Sidebar({ spots, onSpotSelect, selectedSpotId, onAddClick, isFormOpen, onGeocode }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [crowdStatuses, setCrowdStatuses] = useState<Record<string, CrowdStatus>>({});

  useEffect(() => {
    fetchAllCrowdStatuses().then(setCrowdStatuses);
  }, []);
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setGeocodeResults([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!value.trim() || value.trim().length < 3) {
      setGeocodeLoading(false);
      return;
    }

    setGeocodeLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const results = await searchAddress(value.trim(), controller.signal);
        if (!controller.signal.aborted) {
          setGeocodeResults(results);
          setGeocodeLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setGeocodeLoading(false);
        }
      }
    }, 350);
  }, []);

  const handleSelectResult = useCallback((result: GeocodingResult) => {
    setSearch("");
    setGeocodeResults([]);
    onGeocode(result.lat, result.lng, result.displayName, result.city);
  }, [onGeocode]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const filtered = spots.filter((spot) => {
    const matchesCategory = !activeCategory || spot.category === activeCategory;
    return matchesCategory;
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
        </div>
        <p className="sidebar-tagline">Find your next great work spot</p>
      </div>

      <div className="sidebar-search">
        <input
          type="search"
          placeholder="Search an address..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {geocodeLoading && <div className="geocode-loading">Searching...</div>}
        {geocodeResults.length > 0 && (
          <div className="geocode-dropdown">
            {geocodeResults.map((r, i) => (
              <button
                key={i}
                className="geocode-result"
                onClick={() => handleSelectResult(r)}
              >
                {r.displayName}
              </button>
            ))}
          </div>
        )}
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
          const score = calcScore(spot.scores, spot.tags);
          const tags = getSpotDisplayTags(spot).slice(0, 4);
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
                <div className="spot-card-score-block">
                  <span className="spot-card-rating">{score.toFixed(1)}</span>
                  <ScoreDots score={score} className="spot-card-dots" />
                  <span className="spot-card-score-label">{scoreToLabel(score)}</span>
                </div>
              </div>
              <div className="spot-card-address">{spot.address}</div>
              {crowdStatuses[spot.id] && (() => {
                const cs = crowdStatuses[spot.id];
                const info = getBusynessInfo(cs.level);
                return (
                  <div className="spot-card-crowd">
                    <span className="crowd-dot" style={{ background: info.color }} />
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
