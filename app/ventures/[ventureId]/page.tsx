import { desc, eq, isNull, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AGENTS } from "@/lib/agents/registry";
import { assertVentureAccess, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { getStage, STAGES, stageIndex, type StageId } from "@/lib/stages";

export default async function VenturePage({
  params,
}: {
  params: Promise<{ ventureId: string }>;
}) {
  const { ventureId } = await params;

  const user = await requireUser();
  const venture = await assertVentureAccess(user.id, ventureId);
  if (!venture) notFound();

  const stage = getStage(venture.stage as StageId);
  const currentStageIndex = stageIndex(stage.id);

  // What the platform actually knows. This is the thing the old version couldn't
  // show, because it never remembered anything.
  const knownFacts = await db()
    .select()
    .from(schema.facts)
    .where(and(eq(schema.facts.ventureId, venture.id), isNull(schema.facts.supersededBy)))
    .orderBy(desc(schema.facts.createdAt))
    .limit(8);

  const recommended = new Set(stage.recommendedAgents);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 48px" }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{venture.name}</h1>
            <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
              {[venture.industry, venture.region].filter(Boolean).join(" · ") ||
                "Add detail to get sharper advice"}
            </div>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 99,
              fontSize: 10,
              fontWeight: 700,
              background: `color-mix(in srgb, ${stage.color} 18%, transparent)`,
              color: stage.color,
              border: `1px solid color-mix(in srgb, ${stage.color} 30%, transparent)`,
            }}
          >
            {stage.icon} {stage.label}
          </span>
        </div>
        {venture.problem && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
            {venture.problem}
          </p>
        )}
      </header>

      {/* Stage progress */}
      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {STAGES.map((s, i) => (
          <div
            key={s.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= currentStageIndex ? stage.color : "var(--border)",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--dim)", marginBottom: 20 }}>
        {stage.label} — {stage.description}
      </div>

      {/* Recommended next */}
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: 0.8,
            marginBottom: 4,
          }}
        >
          💡 Recommended next
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{stage.nextAction}</div>
      </div>

      {/* What we know — the venture context store, made visible */}
      <section style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
          What VentureForge knows about {venture.name}
        </h2>
        {knownFacts.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.6 }}>
            Nothing yet. As you work with the agents, everything they establish — competitors,
            segments, assumptions, risks — is recorded here with its source, and every other agent
            can build on it.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {knownFacts.map((fact) => (
              <div
                key={fact.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: "var(--dim)",
                    flexShrink: 0,
                    minWidth: 68,
                  }}
                >
                  {fact.kind}
                </span>
                <span style={{ flex: 1 }}>{fact.label}</span>
                {Number(fact.confidence) < 0.5 && (
                  <span style={{ fontSize: 9, color: "var(--amber)" }}>unverified</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Agents */}
      <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
        Specialist agents
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {AGENTS.map((agent) => {
          const isRecommended = recommended.has(agent.id);
          return (
            <Link
              key={agent.id}
              href={`/ventures/${venture.id}/agents/${agent.id}`}
              style={{
                padding: 12,
                borderRadius: 10,
                background: "var(--card)",
                border: isRecommended
                  ? `1px solid color-mix(in srgb, ${agent.color} 45%, transparent)`
                  : "1px solid var(--border)",
                textDecoration: "none",
                display: "block",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{agent.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: agent.color }}>
                  {agent.label}
                </span>
                {isRecommended && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 8,
                      padding: "2px 5px",
                      borderRadius: 99,
                      background: `color-mix(in srgb, ${agent.color} 18%, transparent)`,
                      color: agent.color,
                      fontWeight: 700,
                    }}
                  >
                    NOW
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--dim)", lineHeight: 1.4 }}>
                {agent.tagline}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
