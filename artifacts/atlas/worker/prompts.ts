// Prompt builders for Atlas's two AI tasks. The Worker and the model eval (scripts/src/ai-eval.ts)
// both import from here, so what gets tested is what ships.

import { DAYS_OF_WEEK, calcScore, getSpotDisplayTags, type WorkSpot } from "../src/lib/types";

export interface SpotData {
  name: string;
  category: string;
  city: string;
  address: string;
  tags: string[];
  scores: Record<string, number>;
  overallScore: number;
  description: string;
  aiSummary?: string;
  // One line per day, e.g. "Mon 7:00-19:00, ..., Sun closed"
  hours?: string;
}

export interface SummaryInput {
  name: string;
  category?: string;
  city?: string;
  description: string;
  tags?: string[];
  scoreBreakdown?: string;
  overallScore?: number;
}

export function buildSummaryPrompt(input: SummaryInput): string {
  const tagList = Array.isArray(input.tags) ? input.tags.join(", ") : "none";

  return `Generate a concise 1-2 sentence summary for a remote work spot. Be informative and helpful, focusing on what makes this place good or bad for working remotely.

Spot: ${input.name}
Category: ${input.category || "unknown"}
City: ${input.city || "unknown"}
Description from users: ${input.description}
Category scores: ${input.scoreBreakdown || "unknown"}
Overall workability score: ${typeof input.overallScore === "number" ? `${input.overallScore.toFixed(1)}/5.0` : "unknown"}
Features: ${tagList}

Write a natural, helpful summary in 1-2 sentences. Do not use bullet points.`;
}

export function buildPlannerSystemPrompt(spots: SpotData[], now?: Date): string {
  const spotDescriptions = spots
    .map((s, i) => {
      const scoreEntries = Object.entries(s.scores)
        .map(([k, v]) => `${k}: ${v}/5`)
        .join(", ");
      const tags = s.tags.length > 0 ? s.tags.join(", ") : "none";
      return `${i + 1}. ${s.name}
   Category: ${s.category}
   City: ${s.city}
   Address: ${s.address}
   Overall Score: ${s.overallScore}/5
   Scores: ${scoreEntries}
   Tags: ${tags}${s.hours ? `\n   Hours: ${s.hours}` : ""}
   Description: ${s.description}${s.aiSummary ? `\n   AI Summary: ${s.aiSummary}` : ""}`;
    })
    .join("\n\n");

  const today = now
    ? `\nToday is ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Chicago" })}. Only recommend a spot for a time block when its hours cover that block.\n`
    : "";

  return `You are Atlas Planner, an AI assistant that helps remote workers plan their workday itinerary using spots from the Atlas database.
${today}
You have access to the following ${spots.length} work spots:

${spotDescriptions}

Your role:
- Help users plan a sequence of spots for their workday based on their schedule, preferences, and needs.
- When recommending spots, explain WHY each one fits the specific time block and requirements (e.g., "For your deep focus block from 11-3, I'd suggest Austin Central Library — it scores 5/5 on environment with quiet, library-level noise and generous table space.").
- Consider factors like wifi quality, noise level, outlet availability, food options, hours, and accessibility based on what the user mentions.
- If the user has constraints (e.g., "near downtown", "needs good coffee"), filter your recommendations accordingly.
- Be conversational and helpful. You can ask clarifying questions if the user's request is vague.
- Format your itinerary clearly with time blocks and spot recommendations.
- Only recommend spots from the database above — never invent places.
- Keep responses concise but informative. Use markdown formatting for readability (bold for spot names, bullet points for features).`;
}

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function hoursLine(spot: WorkSpot): string | undefined {
  if (!spot.operatingHours) return undefined;
  return DAYS_OF_WEEK.map((d, i) => {
    const h = spot.operatingHours![d];
    return h.closed ? `${DAY_ABBR[i]} closed` : `${DAY_ABBR[i]} ${h.open}-${h.close}`;
  }).join(", ");
}

export function toPlannerSpot(spot: WorkSpot): SpotData {
  return {
    name: spot.name,
    category: spot.category,
    city: spot.city,
    address: spot.address,
    tags: getSpotDisplayTags(spot),
    scores: spot.scores,
    overallScore: calcScore(spot.scores, spot.tags),
    description: spot.description,
    aiSummary: spot.aiSummary,
    hours: hoursLine(spot),
  };
}
