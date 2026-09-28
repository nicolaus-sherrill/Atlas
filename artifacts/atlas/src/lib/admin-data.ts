// Moderation reads and writes for the admin page. Every call here is also enforced by row-level
// security and admin-only database functions; a non-admin who reaches these gets nothing back.

import { supabase } from "./supabase";
import { getTurnstileToken } from "./turnstile";
import type { CategoryScores, OperatingHours, TagId } from "./types";

export interface SpotSnapshot {
  name: string;
  category: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  tags: TagId[];
  description: string;
  operating_hours: OperatingHours | null;
  website: string | null;
  status: string;
}

export interface PendingEdit {
  id: string;
  spot_id: string;
  changes: Partial<Record<keyof SpotSnapshot, unknown>>;
  note: string;
  created_at: string;
  spot: SpotSnapshot | null;
}

export interface ProblemReport {
  id: string;
  spot_id: string;
  reason: "closed" | "wrong_info" | "duplicate" | "inappropriate" | "other";
  details: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  spot: { name: string; status: string; city: string } | null;
}

export interface AdminRating {
  id: string;
  spot_id: string;
  user_id: string | null;
  scores: CategoryScores;
  status: "visible" | "hidden";
  created_at: string;
  updated_at: string;
  spot: { name: string; scores: CategoryScores; rating_count: number } | null;
}

export interface AdminSpot {
  id: string;
  name: string;
  city: string;
  address: string;
  category: string;
  status: "published" | "removed";
  osm_type: string | null;
  osm_id: number | null;
  rating_count: number;
  created_at: string;
}

const SNAPSHOT = "name, category, city, address, lat, lng, tags, description, operating_hours, website, status";

function check<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

// ---------- sign-in ----------

export async function sendSignInLink(email: string): Promise<void> {
  const captchaToken = await getTurnstileToken("admin_signin");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/admin`, captchaToken },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ---------- queues ----------

export async function fetchPendingEdits(): Promise<PendingEdit[]> {
  return check(
    await supabase
      .from("spot_edits")
      .select(`id, spot_id, changes, note, created_at, spot:spots(${SNAPSHOT})`)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ) as unknown as PendingEdit[];
}

export async function reviewEdit(id: string, approve: boolean): Promise<void> {
  check(await supabase.rpc("review_spot_edit", { p_edit_id: id, p_approve: approve }));
}

export async function fetchReports(status: ProblemReport["status"] = "open"): Promise<ProblemReport[]> {
  return check(
    await supabase
      .from("spot_reports")
      .select("id, spot_id, reason, details, status, created_at, spot:spots(name, status, city)")
      .eq("status", status)
      .order("created_at", { ascending: true }),
  ) as unknown as ProblemReport[];
}

export async function setReportStatus(id: string, status: ProblemReport["status"]): Promise<void> {
  check(
    await supabase
      .from("spot_reports")
      .update({ status, resolved_at: status === "open" ? null : new Date().toISOString() })
      .eq("id", id),
  );
}

// ---------- ratings ----------

export async function fetchRecentRatings(limit = 300): Promise<AdminRating[]> {
  return check(
    await supabase
      .from("ratings")
      .select("id, spot_id, user_id, scores, status, created_at, updated_at, spot:spots(name, scores, rating_count)")
      .order("updated_at", { ascending: false })
      .limit(limit),
  ) as unknown as AdminRating[];
}

export async function setRatingStatus(id: string, status: AdminRating["status"]): Promise<void> {
  check(await supabase.from("ratings").update({ status }).eq("id", id));
}

export async function setRaterStatus(userId: string, status: AdminRating["status"]): Promise<number> {
  return check(await supabase.rpc("set_rater_ratings_status", { p_user_id: userId, p_status: status })) as number;
}

// ---------- spots ----------

export async function fetchAllSpots(): Promise<AdminSpot[]> {
  return check(
    await supabase
      .from("spots")
      .select("id, name, city, address, category, status, osm_type, osm_id, rating_count, created_at")
      .order("created_at", { ascending: false }),
  ) as AdminSpot[];
}

export async function setSpotStatus(id: string, status: AdminSpot["status"]): Promise<void> {
  check(await supabase.from("spots").update({ status }).eq("id", id));
}
