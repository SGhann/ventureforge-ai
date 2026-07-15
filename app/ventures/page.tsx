import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { getStage, type StageId } from "@/lib/stages";

export default async function VenturesPage() {
  const user = await requireUser();

  const ventures = await db()
    .select({ venture: schema.ventures })
    .from(schema.ventures)
    .innerJoin(schema.orgMembers, eq(schema.orgMembers.orgId, schema.ventures.orgId))
    .where(eq(schema.orgMembers.userId, user.id))
    .orderBy(desc(schema.ventures.updatedAt));

  // Nothing to list — send them straight to the wizard rather than showing an
  // empty page with a button on it.
  if (ventures.length === 0) redirect("/ventures/new");

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "48px 20px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Your ventures</h1>
        <Link
          href="/ventures/new"
          style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}
        >
          + New venture
        </Link>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ventures.map(({ venture }) => {
          const stage = getStage(venture.stage as StageId);
          return (
            <Link
              key={venture.id}
              href={`/ventures/${venture.id}`}
              style={{
                padding: 14,
                borderRadius: 10,
                background: "var(--card)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{venture.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {[venture.industry, venture.region].filter(Boolean).join(" · ") ||
                    venture.problem ||
                    "No detail yet"}
                </div>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  padding: "3px 9px",
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
            </Link>
          );
        })}
      </div>
    </main>
  );
}
