import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const rateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimit.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimit.set(ip, recent);
  return true;
}

interface SpotData {
  name: string;
  category: string;
  city: string;
  address: string;
  tags: string[];
  scores: Record<string, number>;
  overallScore: number;
  description: string;
  aiSummary?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildSystemPrompt(spots: SpotData[]): string {
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
   Tags: ${tags}
   Description: ${s.description}${s.aiSummary ? `\n   AI Summary: ${s.aiSummary}` : ""}`;
    })
    .join("\n\n");

  return `You are Atlas Planner, an AI assistant that helps remote workers plan their workday itinerary using spots from the Atlas database.

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

router.post("/chat", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    const { messages, spots } = req.body as {
      messages: ChatMessage[];
      spots: SpotData[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required and must not be empty" });
      return;
    }

    if (!Array.isArray(spots)) {
      res.status(400).json({ error: "spots array is required" });
      return;
    }

    if (messages.length > 50) {
      res.status(400).json({ error: "Conversation too long. Please start a new chat." });
      return;
    }

    const validRoles = new Set(["user", "assistant"]);
    const sanitizedMessages = messages
      .filter((m) => validRoles.has(m.role) && typeof m.content === "string" && m.content.length <= 5000)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 5000) }));

    if (sanitizedMessages.length === 0) {
      res.status(400).json({ error: "No valid messages provided" });
      return;
    }

    const systemPrompt = buildSystemPrompt(spots);

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...sanitizedMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
      max_completion_tokens: 1000,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate response" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.end();
    }
  }
});

export default router;
