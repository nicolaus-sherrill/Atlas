// Suggested edits and problem reports. Both go to the admin queues; neither changes a spot until an
// admin acts on it.

import { supabase } from "./supabase";
import { ensureSession } from "./session";
import type { Category, OperatingHours, TagId } from "./types";

// The fields a suggested edit may change. Scores come from ratings, so they aren't here.
export interface EditableFields {
  name: string;
  category: Category;
  address: string;
  city: string;
  lat: number;
  lng: number;
  website: string;
  description: string;
  tags: TagId[];
  operating_hours: OperatingHours | null;
}

export type ReportReason = "closed" | "wrong_info" | "duplicate" | "inappropriate" | "other";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  closed: "It's permanently closed",
  wrong_info: "Some information is wrong",
  duplicate: "It's listed twice",
  inappropriate: "It isn't a real or suitable place",
  other: "Something else",
};

function friendly(error: { message: string }): Error {
  return new Error(
    error.message.includes("Too many")
      ? "You've sent a lot of suggestions this hour. Try again later."
      : "Couldn't send that. Try again.",
  );
}

export async function suggestEdit(spotId: string, changes: Partial<EditableFields>, note: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from("spot_edits").insert({ spot_id: spotId, changes, note: note.trim() });
  if (error) throw friendly(error);
}

export async function reportProblem(spotId: string, reason: ReportReason, details: string): Promise<void> {
  await ensureSession();
  const { error } = await supabase.from("spot_reports").insert({ spot_id: spotId, reason, details: details.trim() });
  if (error) throw friendly(error);
}
