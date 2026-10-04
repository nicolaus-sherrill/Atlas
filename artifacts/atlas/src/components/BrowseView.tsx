import { useState, useMemo, Fragment } from "react";
import type { WorkSpot, Category } from "@/lib/types";
import { CATEGORIES, calcScore, getSpotDisplayTags, TAGS, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import SpotReveal from "./SpotReveal";
import MultiSelectDropdown from "./MultiSelectDropdown";
import Icon from "./Icon";
import PlaceResults from "./PlaceResults";
import type { GeocodingResult } from "@/lib/geocode";
import { matchesQuery } from "@/lib/search";
import type { CrowdStatus } from "@/lib/crowd";

interface BrowseViewProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  onRated: () => void;
  onNotice: (message: string) => void;
  crowdStatuses: Record<string, CrowdStatus>;
  onCrowdReported: () => void;
  // The shell's one search: it filters these spots, and places matching it list beneath them
  query: string;
  places: GeocodingResult[];
  placesLoading: boolean;
  onPickPlace: (place: GeocodingResult) => void;
  // The theme switch, which sits quietly in the footer line
  themeToggle: React.ReactNode;
  // Only passed for admins; everyone else gets no delete control
  onDeleteSpot?: (id: string) => void;
}

const ALL_FILTER_TAGS = TAGS.map((t) => t.label);

// The row previews this many tags and counts the rest; the full list is in the open row's details
const ROW_TAGS = 3;

export default function BrowseView({ spots, onSpotSelect, onRated, onNotice, crowdStatuses, onCrowdReported, query, places, placesLoading, onPickPlace, themeToggle, onDeleteSpot }: BrowseViewProps) {
  const [activeCities, setActiveCities] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cities = useMemo(() => {
    const set = new Set(spots.map((s) => s.city));
    return Array.from(set).sort();
  }, [spots]);

  const filtered = useMemo(() => {
    return spots.filter((spot) => {
      const matchesSearch = matchesQuery(spot, query);
      const matchesCity = activeCities.size === 0 || activeCities.has(spot.city);
      const matchesCategory = !activeCategory || spot.category === activeCategory;
      const spotTagLabels = getSpotDisplayTags(spot);
      const matchesTags = activeTags.size === 0 || Array.from(activeTags).every((t) => spotTagLabels.includes(t));
      return matchesSearch && matchesCity && matchesCategory && matchesTags;
    });
  }, [spots, query, activeCities, activeCategory, activeTags]);

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
          <p className="browse-tagline">Community-powered spots for remote work, handpicked by the internet.</p>
        </div>
      </header>

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
              <Icon name={cat.icon} weight="bold" size={14} /> {cat.label}
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
              <th className="col-today">Today</th>
              <th className="col-tags">Tags</th>
              <th className="col-score">Score</th>
              <th className="col-map">Map</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((spot, i) => {
              const cat = CATEGORIES.find((c) => c.value === spot.category);
              const score = calcScore(spot.scores, spot.tags);
              const allTags = getSpotDisplayTags(spot);
              const isExpanded = expandedId === spot.id;
              const open = spot.operatingHours ? isOpenNow(spot.operatingHours) : null;
              const toggle = () => setExpandedId(isExpanded ? null : spot.id);
              return (
                <Fragment key={spot.id}>
                  <tr
                    className={`browse-row ${isExpanded ? "expanded" : ""}`}
                    onClick={toggle}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={isExpanded}
                  >
                    <td className="col-num">{String(i + 1).padStart(2, "0")}</td>
                    <td className="col-name">{spot.name}</td>
                    <td className="col-city">{spot.city}</td>
                    <td className="col-category">
                      <span className="browse-category-badge">{cat && <Icon name={cat.icon} weight="bold" size={16} />} {cat?.label}</span>
                    </td>
                    <td className="col-today">
                      {spot.operatingHours ? (
                        <span className={`details-hours ${open ? "open" : "closed"}`}>
                          <span className="hours-dot" aria-hidden="true" />
                          <span className="details-hours-state">{open ? "Open" : "Closed"}</span>
                          <span>{getTodayHoursLabel(spot.operatingHours)}</span>
                        </span>
                      ) : (
                        <span className="browse-muted">No hours yet</span>
                      )}
                    </td>
                    <td className="col-tags">
                      <div className="browse-tag-pills">
                        {allTags.slice(0, ROW_TAGS).map((t) => (
                          <span key={t} className="browse-tag-pill">{t}</span>
                        ))}
                        {allTags.length > ROW_TAGS && <span className="browse-tag-pill more">+{allTags.length - ROW_TAGS}</span>}
                      </div>
                    </td>
                    <td className="col-score">
                      <span className="browse-score">{score.toFixed(1)}</span>
                    </td>
                    <td className="col-map">
                      <button
                        type="button"
                        className="browse-map-link"
                        aria-label={`Show ${spot.name} on the map`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSpotSelect(spot.id);
                        }}
                      >
                        <span className="browse-coord">{spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}</span>
                        <Icon name="arrow-right" weight="bold" size={16} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="browse-detail-row">
                      <td colSpan={8}>
                        <SpotReveal
                          spot={spot}
                          allTags={allTags}
                          crowdStatus={crowdStatuses[spot.id] ?? null}
                          onShowOnMap={() => onSpotSelect(spot.id)}
                          onRated={onRated}
                          onCrowdReported={onCrowdReported}
                          onNotice={onNotice}
                          onDelete={
                            onDeleteSpot
                              ? (id) => {
                                  onDeleteSpot(id);
                                  setExpandedId(null);
                                }
                              : undefined
                          }
                        />
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
        <PlaceResults places={places} loading={placesLoading} onPick={onPickPlace} />
      </div>

      <footer className="browse-footer">
        <p>
          Atlas's spot data is open under the{" "}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
            Open Database License
          </a>
          . Place details include data ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap contributors
          </a>
          .
        </p>
        {themeToggle}
      </footer>

    </div>
  );
}
