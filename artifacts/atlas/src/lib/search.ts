import type { WorkSpot } from "./types";

// The one search field matches a spot by its name, address, city or description
export function matchesQuery(spot: WorkSpot, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    spot.name.toLowerCase().includes(q) ||
    spot.address.toLowerCase().includes(q) ||
    spot.city.toLowerCase().includes(q) ||
    spot.description.toLowerCase().includes(q)
  );
}
