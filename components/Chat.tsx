"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

export type Turn =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; activity: Activity[] }
  | { kind: "error"; text: string };

type Activity = { name: string; status: "running" | "done" | "failed" };

export type AgentSummary = {
  id: string;
  label: string;
  icon: string;
  color: string;
  tagline: string;
  starterPrompts: string[];
};

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  record_fact: "Recording to venture context",
  compute_financial_model: "Computing financial model",
};

export function Chat({
  agent,
  conversationId,
  initialTurns,
}: {
  agent: AgentSummary;
  conversationId: string;
  initialTurns: Turn[];
}) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setInput("");
    setBusy(true);
    setTurns((prev) => [
      ...prev,
      { kind: "user", text: message },
      { kind: "assistant", text: "", activity: [] },
    ]);

    // Mutate the last turn in place as tokens arrive.
    const patch = (fn: (turn: Extract<Turn, { kind: "assistant" }>) => void) => {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.kind === "assistant") {
          const copy = { ...last, activity: [...last.activity] };
          fn(copy);
          next[next.length - 1] = copy;
        }
        return next;
      });
    };

    const fail = (text: string) => {
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        // Drop the empty assistant placeholder rather than leaving a blank bubble.
        if (last?.kind === "assistant" && !last.text) next.pop();
        next.push({ kind: "error", text });
        return next;
      });
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: response.statusText }));
        fail(body.error ?? `Request failed (${response.status}).`);
        return;
      }

      // Belt and braces: only parse what is actually an event stream. If we've
      // been handed HTML (a redirect to a login page, a proxy error page, a CDN
      // interstitial), parsing it as SSE finds no frames and silently yields an
      // empty answer — indistinguishable, to the user, from the agent having
      // nothing to say. Refuse it loudly instead.
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        fail(
          `Expected a response stream but got ${contentType || "an unknown format"}. You may have been signed out — reload and try again.`,
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. A frame can straddle chunk
        // boundaries, so keep the trailing partial in the buffer.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.slice(7);
          const data = JSON.parse(dataLine.slice(6));

          switch (event) {
            case "text":
              patch((t) => {
                t.text += data.text;
              });
              break;
            case "tool_start":
              patch((t) => {
                t.activity.push({ name: data.name, status: "running" });
              });
              break;
            case "tool_result":
              patch((t) => {
                const entry = [...t.activity].reverse().find((a) => a.name === data.name);
                if (entry) entry.status = data.isError ? "failed" : "done";
              });
              break;
            case "error":
              // The server said something went wrong. Surface it as an error,
              // not as an answer. There is no fallback and there shouldn't be —
              // a plausible-looking made-up answer is worse than no answer.
              fail(data.message);
              break;
          }
        }
      }
    } catch (error) {
      fail(
        error instanceof Error
          ? `Lost connection: ${error.message}`
          : "Lost connection to VentureForge.",
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {turns.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 8px" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{agent.icon}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              {agent.tagline}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {agent.starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--muted)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <TurnView key={i} turn={turn} color={agent.color} />
        ))}

        {busy && (
          <div style={{ fontSize: 12, color: "var(--dim)", paddingLeft: 4 }}>
            {agent.label} is working…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={`Message ${agent.label}…`}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--input)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: busy || !input.trim() ? "not-allowed" : "pointer",
              opacity: busy || !input.trim() ? 0.35 : 1,
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}

function TurnView({ turn, color }: { turn: Turn; color: string }) {
  if (turn.kind === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "80%",
            padding: "8px 14px",
            borderRadius: 14,
            background: "color-mix(in srgb, var(--accent) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            fontSize: 14,
          }}
        >
          {turn.text}
        </div>
      </div>
    );
  }

  if (turn.kind === "error") {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "color-mix(in srgb, var(--red) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
          fontSize: 13,
          color: "var(--text)",
        }}
      >
        <strong style={{ color: "var(--red)" }}>Something went wrong.</strong> {turn.text}
      </div>
    );
  }

  return (
    <div>
      {turn.activity.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          {turn.activity.map((item, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: item.status === "failed" ? "var(--red)" : "var(--dim)",
                display: "flex",
                gap: 6,
                alignItems: "center",
              }}
            >
              <span>{item.status === "running" ? "◌" : item.status === "failed" ? "✕" : "✓"}</span>
              <span>{TOOL_LABELS[item.name] ?? item.name}</span>
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 14,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderLeft: `2px solid ${color}`,
        }}
      >
        <Markdown>{turn.text}</Markdown>
      </div>
    </div>
  );
}
