import { supabase } from "./supabase";
import { ensureSession } from "./session";
import type { Category, CategoryScores, OperatingHours, TagId, WorkSpot } from "./types";

interface SpotRow {
  id: string;
  name: string;
  category: Category;
  city: string;
  address: string;
  lat: number;
  lng: number;
  scores: CategoryScores;
  tags: TagId[];
  description: string;
  ai_summary: string | null;
  operating_hours: OperatingHours | null;
  website: string | null;
  osm_type: "node" | "way" | "relation" | null;
  osm_id: number | null;
  rating_count: number;
  created_at: string;
}

const SPOT_COLUMNS =
  "id, name, category, city, address, lat, lng, scores, tags, description, ai_summary, operating_hours, website, osm_type, osm_id, rating_count, created_at";

function fromRow(r: SpotRow): WorkSpot {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    city: r.city,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    scores: r.scores,
    tags: r.tags,
    description: r.description,
    aiSummary: r.ai_summary ?? undefined,
    operatingHours: r.operating_hours ?? undefined,
    website: r.website ?? undefined,
    osmType: r.osm_type ?? undefined,
    osmId: r.osm_id ?? undefined,
    ratingCount: r.rating_count,
    submittedAt: r.created_at,
  };
}

export class DuplicatePlaceError extends Error {
  constructor() {
    super("That place is already on Atlas.");
  }
}

export async function fetchSpots(): Promise<WorkSpot[]> {
  const { data, error } = await supabase
    .from("spots")
    .select(SPOT_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as SpotRow[]).map(fromRow);
}

export async function addSpot(spot: Omit<WorkSpot, "id" | "submittedAt">): Promise<WorkSpot> {
  // The adder's scores become the spot's first rating, credited to them
  await ensureSession();
  const { data, error } = await supabase
    .from("spots")
    .insert({
      name: spot.name,
      category: spot.category,
      city: spot.city,
      address: spot.address,
      lat: spot.lat,
      lng: spot.lng,
      scores: spot.scores,
      tags: spot.tags,
      description: spot.description,
      operating_hours: spot.operatingHours ?? null,
      website: spot.website ?? null,
      osm_type: spot.osmType ?? null,
      osm_id: spot.osmId ?? null,
    })
    .select(SPOT_COLUMNS)
    .single();
  if (error) {
    // The database allows one published spot per real place
    if (error.code === "23505") throw new DuplicatePlaceError();
    throw error;
  }
  return fromRow(data as SpotRow);
}

// Asks the server to write an AI summary for a spot that has a description and no summary yet.
// Safe to call repeatedly; resolves true when a new summary was written.
export async function requestSummary(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/spots/${encodeURIComponent(id)}/summary`, { method: "POST" });
    if (!res.ok) return false;
    const data: { summary?: string | null } = await res.json();
    return !!data.summary;
  } catch {
    return false;
  }
}

// Admin only. Hides the spot from the public map; the row and its history stay recoverable.
export async function removeSpot(id: string): Promise<void> {
  const { error } = await supabase.from("spots").update({ status: "removed" }).eq("id", id);
  if (error) throw error;
}
