import { useState, useEffect, useRef, useCallback } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, RATING_LABELS, computeWorkabilityScore, getSpotTags } from "@/lib/types";
import { spotsToGeoJSON, spotsToKML, downloadFile } from "@/lib/export";
import { searchAddress, type GeocodingResult } from "@/lib/geocode";

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
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setGeocodeResults([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSearching(true);
    try {
      const results = await searchAddress(query, controller.signal);
      setGeocodeResults(results);
      setShowDropdown(results.length > 0);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setGeocodeResults([]);
      setShowDropdown(false);
    } finally {
      if (!controller.signal.aborted) setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setGeocodeResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(search), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, doSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectResult = (result: GeocodingResult) => {
    setSearch("");
    setShowDropdown(false);
    setGeocodeResults([]);
    onGeocode(result.lat, result.lng, result.address, result.city);
  };

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

      <div className="sidebar-search" ref={dropdownRef}>
        <input
          type="search"
          placeholder="Search an address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (geocodeResults.length > 0) setShowDropdown(true);
          }}
        />
        {isSearching && (
          <div className="geocode-loading">Searching...</div>
        )}
        {showDropdown && geocodeResults.length > 0 && (
          <div className="geocode-dropdown">
            {geocodeResults.map((result, i) => (
              <button
                key={`${result.lat}-${result.lng}-${i}`}
                className="geocode-result"
                onClick={() => handleSelectResult(result)}
              >
                <span className="geocode-result-icon">📍</span>
                <span className="geocode-result-text">{result.displayName}</span>
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
