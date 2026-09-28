// Signals that a rating may be spam, for sorting the moderation queue. A flag is a reason to look,
// never an automatic removal.

import type { AdminRating } from "./admin-data";
import type { CategoryScores } from "./types";

export type RatingFlag = "burst" | "all-top" | "all-bottom" | "far-from-average";

export const FLAG_LABELS: Record<RatingFlag, string> = {
  burst: "5+ ratings within an hour",
  "all-top": "Every category 5",
  "all-bottom": "Every category 1",
  "far-from-average": "Far from the spot's average",
};

const BURST_COUNT = 5;
const BURST_WINDOW_MS = 60 * 60 * 1000;
const FAR_POINTS = 1.5;
// Below this many ratings the average is mostly this rating, so comparing says nothing
const MIN_RATINGS_TO_COMPARE = 3;

function mean(scores: CategoryScores): number {
  const values = Object.values(scores).map(Number);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function ratingFlags(rating: AdminRating, all: AdminRating[]): RatingFlag[] {
  const flags: RatingFlag[] = [];
  const values = Object.values(rating.scores).map(Number);

  if (rating.user_id) {
    const t = new Date(rating.updated_at).getTime();
    const nearby = all.filter(
      (r) => r.user_id === rating.user_id && Math.abs(new Date(r.updated_at).getTime() - t) <= BURST_WINDOW_MS,
    );
    if (nearby.length >= BURST_COUNT) flags.push("burst");
  }

  if (values.every((v) => v === 5)) flags.push("all-top");
  if (values.every((v) => v === 1)) flags.push("all-bottom");

  if (rating.spot && rating.spot.rating_count >= MIN_RATINGS_TO_COMPARE) {
    if (Math.abs(mean(rating.scores) - mean(rating.spot.scores)) >= FAR_POINTS) flags.push("far-from-average");
  }

  return flags;
}
