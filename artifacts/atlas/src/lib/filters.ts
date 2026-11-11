import type { Category, GoodFor, WorkSpot } from "./types";

// What the map and the list are narrowed to. Nothing chosen means everything shows.
export interface SpotFilters {
  // Any of these; empty means no narrowing
  goodFor: GoodFor[];
  // Any of these; empty means no narrowing
  categories: Category[];
}

export const NO_FILTERS: SpotFilters = { goodFor: [], categories: [] };

export function matchesFilters(spot: WorkSpot, f: SpotFilters): boolean {
  if (f.goodFor.length > 0 && !f.goodFor.some((g) => spot.goodFor.includes(g))) return false;
  return f.categories.length === 0 || f.categories.includes(spot.category);
}
