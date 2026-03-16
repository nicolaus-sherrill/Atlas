import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

router.post("/summarize", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    const { name, category, city, description, ratings, food, drink, ada, transit } = req.body;

    if (!name || typeof name !== "string" || name.length > 200) {
      res.status(400).json({ error: "name is required and must be under 200 characters" });
      return;
    }
    if (!description || typeof description !== "string" || description.length > 2000) {
      res.status(400).json({ error: "description is required and must be under 2000 characters" });
      return;
    }
    if (city && (typeof city !== "string" || city.length > 100)) {
      res.status(400).json({ error: "city must be under 100 characters" });
      return;
    }

    const transitModes = transit
      ? Object.entries(transit)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(", ")
      : "none";

    const amenities: string[] = [];
    if (food) amenities.push("food");
    if (drink) amenities.push("drinks");
    if (ada) amenities.push("ADA accessible");

    const prompt = `Generate a concise 1-2 sentence summary for a remote work spot. Be informative and helpful, focusing on what makes this place good or bad for working remotely.

Spot: ${name}
Category: ${category || "unknown"}
City: ${city || "unknown"}
Description from users: ${description}
Ratings (1-5): WiFi ${ratings?.wifi || "?"}, Power ${ratings?.power || "?"}, Noise ${ratings?.noise || "?"}, Coffee ${ratings?.coffee || "?"}, Lighting ${ratings?.lighting || "?"}, Seating ${ratings?.seating || "?"}, Outlets ${ratings?.outlets || "?"}
Amenities: ${amenities.length > 0 ? amenities.join(", ") : "none noted"}
Transit access: ${transitModes}

Write a natural, helpful summary in 1-2 sentences. Do not use bullet points.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = completion.choices[0]?.message?.content?.trim() || "";
    res.json({ summary });
  } catch (err) {
    console.error("Summary generation error:", err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export default router;
