// Atlas's server side, on Cloudflare. The React app is a static Pages site; Pages Functions route
// /api/* here (functions/api/[[path]].ts):
//   POST /api/chat                 the "Plan my day" assistant, streamed
//   POST /api/spots/:id/summary    writes an AI summary for a spot that lacks one
//   GET  /api/health
// Pages has no scheduled jobs, so the daily Supabase keep-alive is a separate Worker (keepalive/).

import type { CategoryScores, OperatingHours, TagId, WorkSpot, Category } from "../src/lib/types";
import { buildPlannerSystemPrompt, buildSummaryPrompt, toPlannerSpot } from "./prompts";
import { calcScore, getSpotDisplayTags, SCORE_CATEGORY_LABELS, type ScoreCategory } from "../src/lib/types";

export interface Env {
  AI: Ai;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  // Secret key, set with `wrangler secret put`. Used only to write AI summaries.
  SUPABASE_SECRET_KEY: string;
  AI_MODEL: string;
}

interface SpotRow {
  id: string;
  name: string;
  category: Category;
  city: string;
  address: string;
  lat: number;
  lng: number;
  scores: CategoryScores;
  tags: TagId[];
  description: string;
  ai_summary: string | null;
  operating_hours: OperatingHours | null;
  created_at: string;
}

const SPOT_COLUMNS = "id,name,category,city,address,lat,lng,scores,tags,description,ai_summary,operating_hours,created_at";
// The planner reads every spot on each message; past this many, keep the best-rated
const MAX_PLANNER_SPOTS = 150;

// Every free-plan model thinks privately before answering, and the thinking counts against
// max_tokens. These settings switch it off or turn it down, per the model eval (scripts/src/ai-eval.ts).
const MODEL_OPTIONS: Record<string, Record<string, unknown>> = {
  "@cf/google/gemma-4-26b-a4b-it": { chat_template_kwargs: { enable_thinking: false } },
  "@cf/qwen/qwen3.8-27b": { chat_template_kwargs: { enable_thinking: false } },
  "@cf/openai/gpt-oss-120b": { reasoning_effort: "low" },
};

function modelOptions(env: Env): Record<string, unknown> {
  return MODEL_OPTIONS[env.AI_MODEL] ?? {};
}

function toWorkSpot(r: SpotRow): WorkSpot {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    city: r.city,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    scores: r.scores,
    tags: r.tags,
    description: r.description,
    aiSummary: r.ai_summary ?? undefined,
    operatingHours: r.operating_hours ?? undefined,
    submittedAt: r.created_at,
  };
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

async function readSpots(env: Env, query: string): Promise<SpotRow[]> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/spots?select=${SPOT_COLUMNS}&${query}`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
  });
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
  return res.json();
}

// ---------- chat ----------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function parseMessages(body: unknown): ChatMessage[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) return null;
  const clean = messages
    .filter((m): m is ChatMessage => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  return clean.length > 0 && clean[clean.length - 1].role === "user" ? clean : null;
}

// Workers AI streams server-sent events. Older models send { response }, newer ones the OpenAI
// shape { choices: [{ delta: { content } }] }. The app expects { content }, so normalize here.
function normalizeStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const event = JSON.parse(data);
            const content: unknown = event.response ?? event.choices?.[0]?.delta?.content;
            if (typeof content === "string" && content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          } catch {
            // A partial or non-JSON line; skip it
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

async function chat(request: Request, env: Env): Promise<Response> {
  const messages = parseMessages(await request.json().catch(() => null));
  if (!messages) return json({ error: "Send a conversation that ends with your message." }, 400);

  // The spot list comes from the database, never from the visitor, so it can't be padded with
  // invented places
  const rows = await readSpots(env, "order=created_at.desc&limit=1000");
  const spots = rows
    .map(toWorkSpot)
    .sort((a, b) => calcScore(b.scores, b.tags) - calcScore(a.scores, a.tags))
    .slice(0, MAX_PLANNER_SPOTS)
    .map(toPlannerSpot);

  try {
    const stream = (await env.AI.run(env.AI_MODEL as keyof AiModels, {
      messages: [{ role: "system", content: buildPlannerSystemPrompt(spots, new Date()) }, ...messages],
      max_tokens: 1000,
      stream: true,
      ...modelOptions(env),
    } as never)) as unknown as ReadableStream<Uint8Array>;

    return new Response(normalizeStream(stream), {
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
    });
  } catch (err) {
    // On the free plan, AI stops once the daily allowance is used rather than billing
    console.error("chat failed", err);
    return json({ error: "The planner is unavailable right now. Try again later." }, 503);
  }
}

// ---------- summaries ----------

function extractText(result: unknown): string {
  const r = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  const text = typeof r?.response === "string" ? r.response : r?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

async function summarize(spotId: string, env: Env): Promise<Response> {
  const [row] = await readSpots(env, `id=eq.${encodeURIComponent(spotId)}&limit=1`);
  if (!row) return json({ error: "No such spot." }, 404);
  // Idempotent: only spots without a summary are written, so repeat calls cost one read
  if (row.ai_summary || !row.description.trim()) return json({ summary: row.ai_summary ?? null });

  const spot = toWorkSpot(row);
  const scoreBreakdown = (Object.keys(spot.scores) as ScoreCategory[])
    .map((k) => `${SCORE_CATEGORY_LABELS[k]}: ${spot.scores[k]}/5`)
    .join(", ");
  const prompt = buildSummaryPrompt({
    name: spot.name,
    category: spot.category,
    city: spot.city,
    description: spot.description,
    tags: getSpotDisplayTags(spot),
    scoreBreakdown,
    overallScore: calcScore(spot.scores, spot.tags),
  });

  let summary = "";
  try {
    summary = extractText(
      await env.AI.run(env.AI_MODEL as keyof AiModels, { messages: [{ role: "user", content: prompt }], max_tokens: 150, ...modelOptions(env) } as never),
    ).slice(0, 1000);
  } catch (err) {
    console.error("summary failed", err);
    return json({ error: "Summaries are unavailable right now." }, 503);
  }
  if (!summary) return json({ summary: null });

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/spots?id=eq.${encodeURIComponent(spotId)}&ai_summary=is.null`, {
    method: "PATCH",
    headers: { apikey: env.SUPABASE_SECRET_KEY, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ ai_summary: summary }),
  });
  if (!res.ok) {
    console.error("summary write failed", res.status, await res.text());
    return json({ error: "Couldn't save the summary." }, 502);
  }
  return json({ summary });
}

// ---------- entry ----------

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") return json({ status: "ok" });
  if (url.pathname === "/api/chat" && request.method === "POST") return chat(request, env);

  const summary = url.pathname.match(/^\/api\/spots\/([^/]+)\/summary$/);
  if (summary && request.method === "POST") return summarize(decodeURIComponent(summary[1]), env);

  return json({ error: "Not found" }, 404);
}

// A free Supabase project pauses after a week without activity; one small read a day prevents it
export async function keepAlive(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">): Promise<void> {
  await readSpots(env as Env, "limit=1");
}
