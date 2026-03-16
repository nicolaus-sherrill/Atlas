import type { WorkSpot } from "./types";

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
        ratings: spot.ratings,
        food: spot.food,
        drink: spot.drink,
        ada: spot.ada,
        transit: spot.transit,
      }),
    });

    if (!res.ok) return "";

    const data = await res.json();
    return data.summary || "";
  } catch {
    return "";
  }
}
