import { useState } from "react";
import type { WorkSpot, Category, GoodFor } from "@/lib/types";
import { CATEGORIES, GOOD_FOR, GOOD_FOR_LABELS, categoryDef, spotScore, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import { matchesFilters, type SpotFilters } from "@/lib/filters";
import type { GeocodingResult } from "@/lib/geocode";
import { matchesQuery } from "@/lib/search";
import Icon from "./Icon";
import MadeBy from "./MadeBy";
import PlaceResults from "./PlaceResults";
import MultiSelectDropdown from "./MultiSelectDropdown";

// The filters: what a place is good for, and its category. One set of categories, shown the same
// way everywhere. In the narrow list the categories are pills in one row that scrolls sideways
// when they overflow; in the table they are one dropdown, in one row with the other filters. Over the map on a phone it is one
// scrolling row, where "Good for" swaps the row in place to show its three choices.
// "inline" is the table's: the good-for chips and a category dropdown with no labels, to sit in one
// row with the table's other filters.
export function SpotFilterChips({ filters, onChange, spots, floating, inline = false }: { filters: SpotFilters; onChange: (filters: SpotFilters) => void; spots: WorkSpot[]; floating: boolean; inline?: boolean }) {
  const [goodForOpen, setGoodForOpen] = useState(false);
  const hasSpots = (category: Category) => spots.some((s) => s.category === category);

  const toggleGoodFor = (g: GoodFor) =>
    onChange({ ...filters, goodFor: filters.goodFor.includes(g) ? filters.goodFor.filter((x) => x !== g) : [...filters.goodFor, g] });
  const toggleCategory = (category: Category) =>
    onChange({ ...filters, categories: filters.categories.includes(category) ? filters.categories.filter((c) => c !== category) : [...filters.categories, category] });
  const clearCategories = () => onChange({ ...filters, categories: [] });

  const goodForChips = GOOD_FOR.map((g) => (
    <button key={g.value} className={`category-chip ${filters.goodFor.includes(g.value) ? "active" : ""}`} aria-pressed={filters.goodFor.includes(g.value)} onClick={() => toggleGoodFor(g.value)}>
      {g.label}
    </button>
  ));
  // A category with no spots yet stays in place and can still be picked; it only reads quieter
  const categoryChips = CATEGORIES.map((cat) => (
    <button
      key={cat.value}
      className={`category-chip ${filters.categories.includes(cat.value) ? "active" : ""}${hasSpots(cat.value) ? "" : " is-empty"}`}
      aria-pressed={filters.categories.includes(cat.value)}
      onClick={() => toggleCategory(cat.value)}
    >
      <Icon name={cat.icon} weight="bold" size={16} /> {cat.label}
    </button>
  ));

  if (floating) {
    if (goodForOpen) {
      return (
        <div className="sidebar-categories" role="group" aria-label="Good for">
          <button className="category-chip filter-back" onClick={() => setGoodForOpen(false)} aria-label="Back to all filters">
            <Icon name="arrow-left" weight="bold" size={16} /> Good for
          </button>
          {goodForChips}
        </div>
      );
    }
    const chosen = filters.goodFor;
    const goodForLabel = chosen.length === 0 ? "Good for" : chosen.length === 1 ? `Good for: ${GOOD_FOR_LABELS[chosen[0]]}` : `Good for: ${chosen.length}`;
    return (
      <div className="sidebar-categories" role="group" aria-label="Filters">
        <button className={`category-chip ${chosen.length ? "active" : ""}`} onClick={() => setGoodForOpen(true)}>
          {goodForLabel}
        </button>
        {categoryChips}
      </div>
    );
  }

  if (inline) {
    const chosen = filters.categories.map((c) => categoryDef(c).label);
    return (
      <>
        <div className="filter-inline-group">
          <span className="filter-label">Good for</span>
          <div className="sidebar-categories" role="group" aria-label="Good for">
            {goodForChips}
          </div>
        </div>
        <span className="filter-divider" aria-hidden="true" />
        <MultiSelectDropdown
          label="Category"
          options={CATEGORIES.map((c) => c.label)}
          selected={new Set(chosen)}
          onToggle={(label) => {
            const cat = CATEGORIES.find((c) => c.label === label);
            if (cat) toggleCategory(cat.value);
          }}
          formatTrigger={(sel) => (sel.size === 0 ? "Category ▾" : sel.size <= 2 ? `${Array.from(sel).join(", ")} ▾` : `${sel.size} categories ▾`)}
        />
      </>
    );
  }

  return (
    <div className="filter-block">
      <div className="filter-row">
        <span className="filter-label">Good for</span>
        <div className="sidebar-categories" role="group" aria-label="Good for">
          {goodForChips}
        </div>
      </div>
      <div className="filter-row">
        <span className="filter-label">Category</span>
        <div className="sidebar-categories sidebar-categories-scroll" role="group" aria-label="Category" tabIndex={0}>
          <button className={`category-chip ${filters.categories.length === 0 ? "active" : ""}`} aria-pressed={filters.categories.length === 0} onClick={clearCategories}>
            All
          </button>
          {categoryChips}
        </div>
      </div>
    </div>
  );
}

interface SidebarProps {
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
  selectedSpotId: string | null;
  // The chosen filters, which the app holds so the chips can live outside the list on a phone
  // and the map can be narrowed with the list
  filters: SpotFilters;
  onFiltersChange: (filters: SpotFilters) => void;
  // True on a phone, where the chips float over the map instead of heading the list
  floatingChips: boolean;
  onAddClick: () => void;
  // The shell's one search: it filters these spots, and places matching it list beneath them
  query: string;
  places: GeocodingResult[];
  placesLoading: boolean;
  onPickPlace: (place: GeocodingResult) => void;
  // The theme switch, which sits quietly in the licence line at the foot of the list
  themeToggle: React.ReactNode;
}

export default function Sidebar({ spots, onSpotSelect, selectedSpotId, filters, onFiltersChange, floatingChips, onAddClick, query, places, placesLoading, onPickPlace, themeToggle }: SidebarProps) {
  const filtered = spots.filter((spot) => matchesFilters(spot, filters) && matchesQuery(spot, query));
  const emptyCategory = filters.categories.length === 1 ? categoryDef(filters.categories[0]).label.toLowerCase() : null;

  return (
    <aside className="sidebar">
      {!floatingChips && <SpotFilterChips filters={filters} onChange={onFiltersChange} spots={spots} floating={false} />}

      <div className="sidebar-actions">
        <button className="btn-primary sidebar-add" onClick={onAddClick}>
          + Add a spot
        </button>
      </div>

      <div className="sidebar-count">
        {filtered.length} spot{filtered.length !== 1 ? "s" : ""}
      </div>

      <div className="sidebar-list">
        {/* Hairline two-line rows: the index, the name, then type and today's hours, with the score
            and a → on the right. Everything else is in the details the row opens */}
        {filtered.map((spot, i) => {
          const cat = categoryDef(spot.category);
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
                <span>{cat.label}</span>
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
                <span className="details-score">{spotScore(spot).toFixed(1)}</span>
                <Icon name="arrow-right" weight="bold" size={16} />
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="sidebar-empty">
            <p>{emptyCategory && !query ? `No ${emptyCategory} spots here yet.` : "No spots match."}</p>
            <p>{emptyCategory && !query ? "Know one? Add it." : "Try fewer filters or a different search."}</p>
          </div>
        )}
        <PlaceResults places={places} loading={placesLoading} onPick={onPickPlace} />
        <div className="sidebar-licence">
          {/* The top line sits level with the theme switch; the licence moves down a line */}
          <div className="footer-top">
            <MadeBy />
            {themeToggle}
          </div>
          <p>
            Spot data is open under the{" "}
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
              Open Database License
            </a>
            .
          </p>
        </div>
      </div>
    </aside>
  );
}
