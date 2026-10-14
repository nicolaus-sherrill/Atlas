import { supabase } from "./supabase";
import { currentUserId, ensureSession } from "./session";

export interface Review {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  // Written by this visitor, so they can change or delete it
  mine: boolean;
}

export const REVIEW_MAX_LENGTH = 1000;

// A spot's visible reviews, newest first. Anyone can read them; nobody sees who wrote which.
export async function fetchReviews(spotId: string): Promise<Review[]> {
  const { data, error } = await supabase.rpc("spot_reviews", { p_spot_id: spotId });
  if (error) throw error;
  return (data ?? []) as Review[];
}

// Adds this visitor's review of a spot, or replaces the one they wrote before. One per person.
export async function submitReview(spotId: string, body: string): Promise<void> {
  await ensureSession();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("reviews")
    .upsert({ spot_id: spotId, user_id: userId, body: body.trim() }, { onConflict: "spot_id,user_id" });
  if (error) throw error;
}

export async function deleteMyReview(spotId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("reviews").delete().eq("spot_id", spotId).eq("user_id", userId);
  if (error) throw error;
}
