import type { WorkSpot } from "./types";
import { getSpotDisplayTags, calcScore } from "./types";

export async function generateSummary(spot: WorkSpot): Promise<string> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: spot.name,
        category: spot.category,
        city: spot.city,
        description: spot.description,
        tags: getSpotDisplayTags(spot),
        score: calcScore(spot.tags),
      }),
    });

    if (!res.ok) return "";

    const data = await res.json();
    return data.summary || "";
  } catch {
    return "";
  }
}
