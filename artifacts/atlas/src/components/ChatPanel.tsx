import { useState, useRef, useEffect, useCallback } from "react";
import type { WorkSpot } from "@/lib/types";
import Icon from "./Icon";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  spots: WorkSpot[];
  onClose: () => void;
}

export default function ChatPanel({ spots, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMessage: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

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
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Sorry, something went wrong: ${err.error || "Unknown error"}`,
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

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
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                const current = accumulated;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: current,
                  };
                  return updated;
                });
              }
              if (parsed.error) {
                accumulated += `\n\n_Error: ${parsed.error}_`;
                const current = accumulated;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: current,
                  };
                  return updated;
                });
              }
            } catch {
              // partial JSON; re-buffer for next read
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't connect to the server. Please try again.",
        };
        return updated;
      });
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

  const formatContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    for (const line of lines) {
      const key = i++;
      if (line.startsWith("### ")) {
        elements.push(<h4 key={key} className="chat-md-h3">{processBold(line.slice(4))}</h4>);
      } else if (line.startsWith("## ")) {
        elements.push(<h3 key={key} className="chat-md-h2">{processBold(line.slice(3))}</h3>);
      } else if (line.startsWith("# ")) {
        elements.push(<h2 key={key} className="chat-md-h1">{processBold(line.slice(2))}</h2>);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        elements.push(
          <div key={key} className="chat-md-li">
            <span className="chat-md-bullet">•</span>
            <span>{processBold(line.slice(2))}</span>
          </div>
        );
      } else if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^(\d+\.)\s(.*)/);
        if (match) {
          elements.push(
            <div key={key} className="chat-md-li">
              <span className="chat-md-bullet">{match[1]}</span>
              <span>{processBold(match[2])}</span>
            </div>
          );
        }
      } else if (line.trim() === "") {
        elements.push(<div key={key} className="chat-md-spacer" />);
      } else {
        elements.push(<p key={key} className="chat-md-p">{processBold(line)}</p>);
      }
    }
    return elements;
  };

  const processBold = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="chat-panel-backdrop" onClick={onClose}>
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Atlas Planner</span>
          </div>
          <button className="chat-panel-close" onClick={onClose} aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <Icon name="map-trifold" weight="light" size={32} className="chat-empty-icon" />
              <h3>Plan your workday</h3>
              <p>Describe your schedule, preferences, and needs — I'll recommend the best Atlas spots for each part of your day.</p>
              <div className="chat-suggestions">
                <button
                  className="chat-suggestion"
                  onClick={() => setInput("I have meetings from 9-11, then deep focus work until 3, then casual emails until 5. I need fast wifi and good coffee.")}
                >
                  Plan a full workday with meetings and focus time
                </button>
                <button
                  className="chat-suggestion"
                  onClick={() => setInput("I need a quiet place to work for 4 hours this afternoon. Good wifi is essential.")}
                >
                  Find a quiet afternoon work spot
                </button>
                <button
                  className="chat-suggestion"
                  onClick={() => setInput("What are the best spots for someone who needs lots of outlets and wants to work late?")}
                >
                  Best spots for late-night work with outlets
                </button>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-message chat-message-${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="chat-avatar">
                  <svg width="14" height="14" viewBox="0 0 96 96" fill="none">
                    <path fill="currentColor" d="M1.107 0h55.354v34.596H1.107zm60.297 0H67c16.016 0 29 12.984 29 29v65.893H61.404V0Z"/>
                    <circle cx="28.725" cy="67.275" r="28.725" fill="currentColor"/>
                  </svg>
                </div>
              )}
              <div className={`chat-bubble chat-bubble-${msg.role}`}>
                {msg.role === "assistant" ? (
                  <div className="chat-md">{formatContent(msg.content)}</div>
                ) : (
                  msg.content
                )}
                {msg.role === "assistant" && isStreaming && idx === messages.length - 1 && (
                  <span className="chat-cursor">▊</span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Describe your workday..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isStreaming}
            />
            <button
              className="chat-send"
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="chat-disclaimer">Atlas Planner uses AI to recommend spots. Always verify details independently.</p>
        </div>
      </div>
    </div>
  );
}
