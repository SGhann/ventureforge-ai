import type Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chat, type Turn } from "@/components/Chat";
import { getAgent } from "@/lib/agents/registry";
import { assertVentureAccess, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

export default async function AgentChatPage({
  params,
}: {
  params: Promise<{ ventureId: string; agentId: string }>;
}) {
  const { ventureId, agentId } = await params;

  const user = await requireUser();
  const venture = await assertVentureAccess(user.id, ventureId);
  if (!venture) notFound();

  const agent = getAgent(agentId);
  if (!agent) notFound();

  const database = db();

  // One conversation per (venture, agent) for now, so context accumulates rather
  // than fragmenting across throwaway threads. Multiple named threads per agent
  // is a later feature.
  let conversation = await database.query.conversations.findFirst({
    where: and(
      eq(schema.conversations.ventureId, venture.id),
      eq(schema.conversations.agentId, agent.id),
    ),
  });

  if (!conversation) {
    const [created] = await database
      .insert(schema.conversations)
      .values({ ventureId: venture.id, agentId: agent.id })
      .returning();
    conversation = created!;
  }

  const history = await database.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversation.id),
    orderBy: schema.messages.createdAt,
  });

  // Flatten stored content blocks into renderable turns. Tool calls and results
  // are part of the durable record but aren't shown as chat bubbles.
  const initialTurns = history.flatMap((message): Turn[] => {
    const blocks = message.content as Anthropic.ContentBlockParam[];
    const text = blocks
      .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) return [];
    return message.role === "user"
      ? [{ kind: "user", text }]
      : [{ kind: "assistant", text, activity: [] }];
  });

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Link
          href={`/ventures/${venture.id}`}
          style={{ color: "var(--muted)", fontSize: 18, textDecoration: "none" }}
        >
          ‹
        </Link>
        <span style={{ fontSize: 18 }}>{agent.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: agent.color }}>{agent.label}</div>
          <div style={{ fontSize: 11, color: "var(--dim)" }}>{venture.name}</div>
        </div>
      </header>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <Chat
          agent={{
            id: agent.id,
            label: agent.label,
            icon: agent.icon,
            color: agent.color,
            tagline: agent.tagline,
            starterPrompts: agent.starterPrompts,
          }}
          conversationId={conversation.id}
          initialTurns={initialTurns}
        />
      </div>
    </div>
  );
}
