import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { AGENTS } from "@/lib/agents/registry";
import { getUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { STAGES } from "@/lib/stages";

export default async function LandingPage() {
  const user = await getUser();

  // A signed-in user never needs the marketing page. Straight to their work:
  // one venture goes to it, several to the picker, none to the wizard.
  if (user) {
    const ventures = await db()
      .select({ id: schema.ventures.id })
      .from(schema.ventures)
      .innerJoin(schema.orgMembers, eq(schema.orgMembers.orgId, schema.ventures.orgId))
      .where(eq(schema.orgMembers.userId, user.id))
      .limit(2);

    if (ventures.length === 0) redirect("/ventures/new");
    if (ventures.length === 1) redirect(`/ventures/${ventures[0]!.id}`);
    redirect("/ventures");
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "56px 20px 48px" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 24 }}>🔨</span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: "linear-gradient(135deg, var(--accent), var(--purple))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            VentureForge
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(26px, 6vw, 40px)",
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          From idea to IPO,{" "}
          <span
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--purple), var(--green))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            with a team that remembers
          </span>
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "var(--muted)",
            maxWidth: 480,
            margin: "0 auto 12px",
            lineHeight: 1.6,
          }}
        >
          Eleven specialists — market research, financial modeling, legal, fundraising, and more —
          that carry everything they learn about your venture forward, so the advice gets sharper
          every time you come back.
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--dim)",
            maxWidth: 460,
            margin: "0 auto 28px",
            lineHeight: 1.6,
          }}
        >
          Financial models are computed by a deterministic engine and audited against seven checks
          before you ever see them. Market claims are searched and cited. Nothing is invented.
        </p>

        <Link
          href="/auth/sign-in"
          style={{
            display: "inline-block",
            padding: "13px 32px",
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--accent), #2563eb)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Get started →
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          gap: 5,
          overflowX: "auto",
          padding: "36px 0 28px",
        }}
      >
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            style={{
              flex: "0 0 auto",
              padding: "8px 12px",
              borderRadius: 10,
              background: "var(--card)",
              border: "1px solid var(--border)",
              textAlign: "center",
              minWidth: 76,
            }}
          >
            <div style={{ fontSize: 18 }}>{stage.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: stage.color, marginTop: 2 }}>
              {stage.label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}
      >
        {AGENTS.map((agent) => (
          <div
            key={agent.id}
            style={{
              padding: 10,
              borderRadius: 10,
              background: "var(--card)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>{agent.icon}</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: agent.color }}>{agent.label}</div>
              <div style={{ fontSize: 9, color: "var(--dim)", lineHeight: 1.3 }}>
                {agent.tagline}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
