import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { FactKind } from "@/lib/agents/types";
import { db, schema } from "@/lib/db/client";
import { getStage, type StageId } from "@/lib/stages";

export type Venture = typeof schema.ventures.$inferSelect;
export type Fact = typeof schema.facts.$inferSelect;

/**
 * How many facts of a single kind we compile into a brief. A venture with 400
 * recorded competitors should not blow the context window — and if we ever hit
 * this ceiling, we say so in the brief rather than silently truncating.
 */
const MAX_FACTS_PER_KIND = 40;

/**
 * Load the current (non-superseded) facts an agent is allowed to read.
 */
export async function loadFacts(ventureId: string, kinds: FactKind[]): Promise<Fact[]> {
  if (kinds.length === 0) return [];

  return db()
    .select()
    .from(schema.facts)
    .where(
      and(
        eq(schema.facts.ventureId, ventureId),
        inArray(schema.facts.kind, kinds),
        isNull(schema.facts.supersededBy),
      ),
    )
    .orderBy(desc(schema.facts.createdAt));
}

function describeSource(source: schema.FactSource): string {
  switch (source.type) {
    case "user":
      return "stated by founder";
    case "agent":
      return `established by ${source.agentId}`;
    case "web":
      return `source: ${source.title ?? source.url} (${source.url}, accessed ${source.accessedAt.slice(0, 10)})`;
    case "document":
      return `from uploaded document${source.page ? `, p.${source.page}` : ""}`;
    case "computed":
      return `computed by ${source.engine}`;
  }
}

/**
 * Turn the venture's stored knowledge into the brief an agent reads.
 *
 * This function is the entire answer to "why is the advice generic?" — a model
 * with no facts about you can only give you the textbook. Everything here is
 * sourced and dated, so the agent can tell the difference between something the
 * founder asserted last year and something it verified on the web this morning.
 */
export function compileBrief(venture: Venture, facts: Fact[]): string {
  const stage = getStage(venture.stage as StageId);
  const lines: string[] = [];

  lines.push("<venture_context>");
  lines.push(`Name: ${venture.name}`);
  if (venture.problem) lines.push(`Problem being solved: ${venture.problem}`);
  if (venture.industry) lines.push(`Industry: ${venture.industry}`);
  if (venture.region) lines.push(`Target market / region: ${venture.region}`);
  lines.push(`Current stage: ${stage.label} — ${stage.description}`);

  if (facts.length === 0) {
    lines.push("");
    lines.push(
      "No facts have been recorded for this venture yet. Ask about the specifics you need rather than assuming; record what you learn with the record_fact tool so other agents can build on it.",
    );
    lines.push("</venture_context>");
    return lines.join("\n");
  }

  const byKind = new Map<string, Fact[]>();
  for (const fact of facts) {
    const bucket = byKind.get(fact.kind);
    if (bucket) bucket.push(fact);
    else byKind.set(fact.kind, [fact]);
  }

  for (const [kind, all] of byKind) {
    const shown = all.slice(0, MAX_FACTS_PER_KIND);
    lines.push("");
    lines.push(`## Known ${kind}s (${all.length})`);
    if (shown.length < all.length) {
      lines.push(
        `(showing the ${shown.length} most recent of ${all.length} — ask the user if you need the full set)`,
      );
    }
    for (const fact of shown) {
      const confidence = Number(fact.confidence);
      const caveat = confidence < 0.5 ? " [LOW CONFIDENCE — verify before relying on this]" : "";
      lines.push(
        `- ${fact.label}: ${JSON.stringify(fact.value)} — ${describeSource(fact.source)}, recorded ${fact.createdAt.toISOString().slice(0, 10)}${caveat}`,
      );
    }
  }

  lines.push("</venture_context>");
  return lines.join("\n");
}

/** Load and compile in one step. */
export async function briefFor(venture: Venture, kinds: FactKind[]): Promise<string> {
  const facts = await loadFacts(venture.id, kinds);
  return compileBrief(venture, facts);
}
