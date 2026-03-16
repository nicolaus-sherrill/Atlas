import type { WorkSpot } from "./types";
import { getSpotDisplayTags, calcScore, SCORE_CATEGORY_LABELS } from "./types";

export async function generateSummary(spot: WorkSpot): Promise<string> {
  try {
    const scoreBreakdown = (Object.keys(spot.scores) as Array<keyof typeof spot.scores>)
      .map((key) => `${SCORE_CATEGORY_LABELS[key]}: ${spot.scores[key]}/5`)
      .join(", ");

    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: spot.name,
        category: spot.category,
        city: spot.city,
        description: spot.description,
        tags: getSpotDisplayTags(spot),
        scores: spot.scores,
        scoreBreakdown,
        overallScore: calcScore(spot.scores, spot.tags),
      }),
    });

    if (!res.ok) return "";

    const data = await res.json();
    return data.summary || "";
  } catch {
    return "";
  }
}
