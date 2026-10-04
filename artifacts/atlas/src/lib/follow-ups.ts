// The planner ends each reply with a few follow-ups under a "Follow-ups:" line (worker/prompts.ts).
// This splits them off, so the bubble shows the reply and the chat shows the follow-ups as rows.
// The model eval (scripts/src/ai-eval.ts) checks replies with this same parser.

const MARKER = /^\s*\**\s*follow[- ]?ups?\s*:?\s*\**\s*$/i;

export interface SplitReply {
  body: string;
  followUps: string[];
}

export function splitFollowUps(content: string): SplitReply {
  const lines = content.split("\n");
  const at = lines.findIndex((line) => MARKER.test(line));
  if (at === -1) {
    // Mid-stream, the marker may be half written on the last line; keep it out of the bubble
    const last = lines[lines.length - 1].trim().toLowerCase().replace(/^\*+/, "");
    if (last.length >= 3 && "follow-ups:".startsWith(last)) {
      return { body: lines.slice(0, -1).join("\n").trimEnd(), followUps: [] };
    }
    return { body: content, followUps: [] };
  }
  const followUps = lines
    .slice(at + 1)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { body: lines.slice(0, at).join("\n").trimEnd(), followUps };
}
