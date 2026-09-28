import { supabase } from "./supabase";
import { currentUserId, ensureSession } from "./session";
import type { CategoryScores } from "./types";

// This visitor's own rating for a spot, if they've given one. Never creates an identity.
export async function fetchMyRating(spotId: string): Promise<CategoryScores | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from("ratings")
    .select("scores")
    .eq("spot_id", spotId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.scores as CategoryScores | undefined) ?? null;
}

// Adds this visitor's rating, or replaces the one they gave before. The spot's average updates in
// the database.
export async function submitRating(spotId: string, scores: CategoryScores): Promise<void> {
  await ensureSession();
  const userId = await currentUserId();
  const { error } = await supabase
    .from("ratings")
    .upsert({ spot_id: spotId, user_id: userId, scores }, { onConflict: "spot_id,user_id" });
  if (error) throw error;
}
