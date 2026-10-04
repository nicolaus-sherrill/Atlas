import { useState, useRef, useEffect, Fragment } from "react";
import type { WorkSpot } from "@/lib/types";
import { CATEGORIES, calcScore, isOpenNow, getTodayHoursLabel } from "@/lib/types";
import Icon from "./Icon";
import { splitFollowUps } from "@/lib/follow-ups";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  spots: WorkSpot[];
  // Picks a spot the agent recommended, which opens it on the map
  onSpotSelect: (id: string) => void;
  onClose: () => void;
}

// The Atmo logomark, as the agent's face
function AgentAvatar({ size }: { size: "thread" | "hero" }) {
  return (
    <span className={`avatar${size === "hero" ? " avatar-hero" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 96 96">
        <path fill="currentColor" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z" />
        <circle cx="28.725" cy="67.275" r="28.725" fill="currentColor" />
      </svg>
    </span>
  );
}

const SUGGESTIONS = [
  { label: "Calls in the morning, focus after lunch", prompt: "I have calls from 9 to 11, then deep focus work until 3. I need fast wifi and good coffee." },
  { label: "A quiet afternoon with good wifi", prompt: "I need a quiet place to work for 4 hours this afternoon. Good wifi is essential." },
  { label: "Somewhere open late with outlets", prompt: "What are the best spots for someone who needs lots of outlets and wants to work late?" },
];

// The chat: a floating card beside the map controls on desktop, a full-height sheet on a phone.
// The agent's replies come back as plain markdown; any Atlas spot they name becomes a row in the
// bubble that opens the spot on the map.
export default function ChatPanel({ spots, onSpotSelect, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "end",
    });
  }, [messages]);

  // Focus moves into the card on open; Escape closes it
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // A modal opened from the chat's spot takes Escape for itself
      if (e.key === "Escape" && !document.querySelector(".browse-modal-backdrop")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A stream still running when the card closes is stopped, not left to finish unseen
  useEffect(() => () => abortRef.current?.abort(), []);

  // The composer grows with what's typed, up to a few lines
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    inputRef.current?.focus();
  };

  const replaceLast = (content: string) =>
    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server reads the spots itself, so a visitor can't add invented places to the planner
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        replaceLast(`Sorry, something went wrong: ${err.error || "Unknown error"}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;
          const data = trimmedLine.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) accumulated += parsed.content;
            if (parsed.error) accumulated += `\n\n_Error: ${parsed.error}_`;
            replaceLast(accumulated);
          } catch {
            // partial JSON; re-buffer for next read
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      replaceLast("Sorry, I couldn't connect to the server. Please try again.");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Messages in runs: consecutive messages from one speaker share a group
  const runs: { role: ChatMessage["role"]; items: { message: ChatMessage; index: number }[] }[] = [];
  messages.forEach((message, index) => {
    const last = runs[runs.length - 1];
    if (last && last.role === message.role) last.items.push({ message, index });
    else runs.push({ role: message.role, items: [{ message, index }] });
  });

  const waiting = isStreaming && messages[messages.length - 1]?.content === "";

  return (
    <div className="chat-root">
      <div className="chat-scrim" onClick={onClose} aria-hidden="true" />
      <section className="chat-card" role="dialog" aria-label="Plan my day">
        <header className="chat-head">
          <h2 className="chat-title">Plan my day</h2>
          <div className="chat-head-actions">
            <button type="button" className="icon-button" aria-label="New chat" onClick={startNewChat}>
              <Icon name="note-pencil" weight="bold" size={16} />
            </button>
            <button type="button" className="icon-button" aria-label="Close chat" onClick={onClose}>
              <Icon name="x" weight="bold" size={16} />
            </button>
          </div>
        </header>

        {messages.length === 0 ? (
          <div className="chat-empty">
            <AgentAvatar size="hero" />
            <p className="chat-greeting">
              Where are you working today?
              <span>Tell me your day and I'll match it to spots.</span>
            </p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} type="button" className="chat-arrow-row" onClick={() => sendMessage(s.prompt)}>
                  <Icon name="arrow-right" weight="bold" size={16} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread" aria-live="polite">
            {runs.map((run, r) =>
              run.role === "user" ? (
                <div key={r} className="chat-run-user">
                  {run.items.map(({ message, index }, i) => (
                    <div key={index} className={`chat-bubble chat-bubble-user${i === run.items.length - 1 ? " has-point" : ""}`}>
                      {message.content}
                    </div>
                  ))}
                </div>
              ) : (
                <div key={r} className="chat-run-agent">
                  <AgentAvatar size="thread" />
                  <AgentReplies
                    items={run.items}
                    waiting={waiting && run.items.some(({ index }) => index === messages.length - 1)}
                    // Follow-ups only under the latest reply, once it has finished
                    showFollowUps={r === runs.length - 1 && !isStreaming}
                    onFollowUp={(text) => sendMessage(text)}
                    spots={spots}
                    onSpotSelect={onSpotSelect}
                  />
                </div>
              ),
            )}
            <div ref={threadEndRef} />
          </div>
        )}

        <div className="chat-foot">
          <div className="chat-composer">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask about your day"
              aria-label="Ask about your day"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              type="button"
              className="chat-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isStreaming}
              aria-label="Send"
            >
              <Icon name="arrow-up" weight="bold" size={16} />
            </button>
          </div>
          <p className="chat-disclaimer">The planner uses AI. Check the details before you go.</p>
        </div>
      </section>
    </div>
  );
}

// The spots a block of the reply names, in the order it names them. Longer names are matched
// first, so a shorter name inside one ("Desnudo Coffee" in "Desnudo Coffee: South Lamar") isn't
// counted twice. Each spot is shown once per reply.
function spotsNamedIn(text: string, spots: WorkSpot[], alreadyShown: Set<string>): WorkSpot[] {
  const lower = text.toLowerCase();
  let rest = lower;
  const found: WorkSpot[] = [];
  for (const spot of [...spots].sort((a, b) => b.name.length - a.name.length)) {
    const name = spot.name.toLowerCase();
    if (!rest.includes(name)) continue;
    rest = rest.split(name).join(" ");
    if (alreadyShown.has(spot.id)) continue;
    alreadyShown.add(spot.id);
    found.push(spot);
  }
  return found.sort((a, b) => lower.indexOf(a.name.toLowerCase()) - lower.indexOf(b.name.toLowerCase()));
}

interface AgentRepliesProps {
  items: { message: ChatMessage; index: number }[];
  waiting: boolean;
  showFollowUps: boolean;
  onFollowUp: (text: string) => void;
  spots: WorkSpot[];
  onSpotSelect: (id: string) => void;
}

// One agent turn: each paragraph block is a bubble, and the first carries the point beside the
// avatar. A spot named in a block gets a row under it.
function AgentReplies({ items, waiting, showFollowUps, onFollowUp, spots, onSpotSelect }: AgentRepliesProps) {
  const shown = new Set<string>();
  const followUps = splitFollowUps(items[items.length - 1].message.content).followUps;
  const blocks = items.flatMap(({ message, index }) =>
    splitFollowUps(message.content)
      .body.split(/\n\s*\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, b) => ({ key: `${index}-${b}`, text })),
  );

  return (
    <div className="chat-replies">
      {/* Before the reply starts: the steps the planner really takes, in place of a blinking cursor */}
      {waiting && (
        <div className="chat-steps" role="status">
          <div className="chat-steps-row">
            <Icon name="check" weight="bold" size={16} />
            <span>Read the {spots.length} spots on Atlas</span>
          </div>
          <div className="chat-steps-row">
            <Icon name="circle-notch" weight="bold" size={16} className="chat-steps-busy" />
            <span>Writing your plan</span>
          </div>
        </div>
      )}
      {blocks.map(({ key, text }, i) => (
        <div key={key} className={`chat-bubble chat-bubble-agent${i === 0 ? " has-point" : ""}`}>
          <div className="chat-md">{formatContent(text)}</div>
          {spotsNamedIn(text, spots, shown).map((spot) => (
            <SpotRef key={spot.id} spot={spot} onSelect={() => onSpotSelect(spot.id)} />
          ))}
        </div>
      ))}
      {/* → rows under the group, outside the bubbles: what the planner suggests asking next */}
      {showFollowUps && followUps.length > 0 && (
        <div className="chat-follow-ups">
          {followUps.map((text) => (
            <button key={text} type="button" className="chat-arrow-row" onClick={() => onFollowUp(text)}>
              <Icon name="arrow-right" weight="bold" size={16} />
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A recommended spot, embedded in the bubble: name, type, today's hours and score
function SpotRef({ spot, onSelect }: { spot: WorkSpot; onSelect: () => void }) {
  const cat = CATEGORIES.find((c) => c.value === spot.category);
  const open = spot.operatingHours ? isOpenNow(spot.operatingHours) : null;
  return (
    <button type="button" className="chat-spotref" onClick={onSelect}>
      <span className="chat-spotref-name">{spot.name}</span>
      <span className="details-score">{calcScore(spot.scores, spot.tags).toFixed(1)}</span>
      <span className={`chat-spotref-meta details-hours ${open ? "open" : "closed"}`}>
        {cat?.label ?? spot.category}
        {spot.operatingHours && (
          <>
            <span className="hours-dot" aria-hidden="true" />
            {open ? "Open" : "Closed"} · {getTodayHoursLabel(spot.operatingHours)}
          </>
        )}
      </span>
    </button>
  );
}

// The planner's markdown, as far as it uses it: headings, bullets, numbered lines and bold
function formatContent(content: string) {
  return content.split("\n").map((line, key) => {
    const heading = line.match(/^#{1,3}\s(.*)/);
    if (heading) return <h4 key={key} className="chat-md-h">{processBold(heading[1])}</h4>;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <div key={key} className="chat-md-li">
          <span className="chat-md-bullet">•</span>
          <span>{processBold(line.slice(2))}</span>
        </div>
      );
    }
    const numbered = line.match(/^(\d+\.)\s(.*)/);
    if (numbered) {
      return (
        <div key={key} className="chat-md-li">
          <span className="chat-md-bullet">{numbered[1]}</span>
          <span>{processBold(numbered[2])}</span>
        </div>
      );
    }
    if (line.trim() === "") return <Fragment key={key} />;
    return <p key={key} className="chat-md-p">{processBold(line)}</p>;
  });
}

function processBold(text: string): React.ReactNode {
  return text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
  );
}
