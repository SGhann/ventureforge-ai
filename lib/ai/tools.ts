import type Anthropic from "@anthropic-ai/sdk";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import type { AgentDef, FactKind } from "@/lib/agents/types";
import { db, schema } from "@/lib/db/client";
import { AssumptionsSchema, computeModel } from "@/lib/finance/engine";

/**
 * Tool definitions and handlers.
 *
 * Each agent declares which tools it may call (see the registry). This is where
 * agents stop being "a system prompt that describes expertise" and start being
 * something that can actually find a competitor, check a regulation, or compute
 * a balance sheet.
 */

export type ToolContext = {
  ventureId: string;
  conversationId: string;
  agent: AgentDef;
};

const RecordFactSchema = z
  .object({
    kind: z
      .string()
      .describe("One of: assumption, competitor, segment, metric, risk, decision, team, milestone, regulatory, channel"),
    label: z.string().describe("Short handle for this fact, e.g. 'CAC (paid, Freetown)'"),
    value: z
      .record(z.string(), z.unknown())
      .describe("The content as a JSON object. Include units and currency where relevant."),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("How confident you are. Below 0.5 marks it as needing verification."),
    sourceNote: z
      .string()
      .describe(
        "Where this came from: the founder said it, you derived it, or a URL you retrieved. Be specific.",
      ),
  })
  .strict();

/** Build the tool array for a turn, in a stable order so the prompt cache holds. */
export function toolDefsFor(agent: AgentDef): Anthropic.ToolUnion[] {
  const tools: Anthropic.ToolUnion[] = [];

  // Server-side tools first, then custom — deterministic ordering matters,
  // because tools render at position 0 and any reorder invalidates the cache.
  if (agent.tools.includes("web_search")) {
    tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 8 });
  }

  if (agent.tools.includes("record_fact")) {
    tools.push({
      name: "record_fact",
      description:
        "Record something durable you have established about this venture, so every other agent can build on it. Use this for facts with a shelf life — a competitor you found, a segment you defined, an assumption the model depends on. Do not use it for conversational chatter. Recording a fact supersedes any previous fact with the same label; the old one is kept for history.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: agent.writes,
            description: "The kind of fact. You may only write the kinds listed here.",
          },
          label: { type: "string", description: "Short handle, e.g. 'CAC (paid, Freetown)'" },
          value: {
            type: "object",
            description: "The content, as a JSON object. Include units and currency.",
            additionalProperties: true,
          },
          confidence: {
            type: "number",
            description: "0 to 1. Below 0.5 flags the fact as needing verification.",
          },
          sourceNote: {
            type: "string",
            description: "Where this came from. A URL if you retrieved it, else how you derived it.",
          },
        },
        required: ["kind", "label", "value", "confidence", "sourceNote"],
        additionalProperties: false,
      },
    });
  }

  if (agent.tools.includes("compute_financial_model")) {
    tools.push({
      name: "compute_financial_model",
      description:
        "Compute a full 3-statement financial model from assumptions. You provide the assumptions; a deterministic engine computes the P&L, balance sheet, cash flow, unit economics and runway, and runs seven validation checks. Use this for ANY financial projection — never do the arithmetic yourself. If a check fails, report which one and fix the assumption behind it rather than working around it. Note the engine's limits: annual periods, no working capital, equity financing only.",
      input_schema: {
        type: "object",
        properties: zodToToolProperties(),
        required: [
          "periods",
          "startingCash",
          "startingCustomers",
          "arpu",
          "grossMarginPct",
          "annualChurnRate",
          "cac",
          "marketingSpend",
          "personnelCosts",
          "techCosts",
          "otherOpex",
          "capex",
        ],
      },
    });
  }

  return tools;
}

/** The engine's input schema, expressed for the tool definition. */
function zodToToolProperties(): Record<string, unknown> {
  return {
    periods: { type: "integer", description: "Number of annual periods to project (1-10)" },
    startingCash: { type: "number", description: "Cash on hand at period 0, USD" },
    startingCustomers: { type: "number", description: "Customer count at period 0" },
    arpu: { type: "number", description: "Average ANNUAL revenue per customer, USD" },
    grossMarginPct: { type: "number", description: "Gross margin as a decimal, e.g. 0.75" },
    annualChurnRate: { type: "number", description: "Customers lost per year as a decimal, e.g. 0.2" },
    cac: { type: "number", description: "Fully-loaded cost to acquire one customer, USD" },
    marketingSpend: {
      type: "array",
      items: { type: "number" },
      description: "Marketing spend per period, one entry per period. New customers = spend / CAC.",
    },
    personnelCosts: { type: "array", items: { type: "number" }, description: "Personnel cost per period" },
    techCosts: { type: "array", items: { type: "number" }, description: "Tech/infra cost per period" },
    otherOpex: { type: "array", items: { type: "number" }, description: "Other opex per period" },
    capex: { type: "array", items: { type: "number" }, description: "Capital expenditure per period" },
    depreciationYears: { type: "integer", description: "Straight-line life in years. Default 5." },
    taxRate: { type: "number", description: "Corporate tax rate as a decimal. Default 0.25." },
    fundingRounds: {
      type: "array",
      description: "Equity rounds. Debt is not modelled.",
      items: {
        type: "object",
        properties: {
          period: { type: "integer", description: "Period the round closes in (1-indexed)" },
          amount: { type: "number", description: "Gross proceeds, USD" },
          label: { type: "string", description: "Round name, e.g. 'Seed'" },
        },
        required: ["period", "amount", "label"],
      },
    },
  };
}

export type ToolOutcome = { content: string; isError: boolean };

/**
 * Execute one tool call.
 *
 * Errors are returned as tool results with isError, never thrown — the model
 * needs to see what went wrong so it can correct course, and a thrown error
 * would kill the turn instead.
 */
export async function executeTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "record_fact":
        return await handleRecordFact(input, ctx);
      case "compute_financial_model":
        return handleComputeModel(input);
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: `Tool failed: ${message}`, isError: true };
  }
}

async function handleRecordFact(input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const parsed = RecordFactSchema.safeParse(input);
  if (!parsed.success) {
    return { content: `Invalid input: ${parsed.error.message}`, isError: true };
  }
  const fact = parsed.data;

  // Enforce write permissions server-side. The tool definition restricts `kind`
  // via an enum, but a model can still emit something outside it — the enum is a
  // strong hint, not a guarantee we get to rely on.
  if (!ctx.agent.writes.includes(fact.kind as FactKind)) {
    return {
      content: `The ${ctx.agent.label} agent may not write facts of kind "${fact.kind}". It may write: ${ctx.agent.writes.join(", ")}.`,
      isError: true,
    };
  }

  const database = db();

  // Insert the new fact, then point any current fact with the same label at it.
  // Order matters: the new row must exist before anything can be superseded BY it.
  // Both steps run in one transaction so a crash between them can't leave the
  // venture with two live facts making contradictory claims.
  const inserted = await database.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.facts)
      .values({
        ventureId: ctx.ventureId,
        kind: fact.kind as FactKind,
        label: fact.label,
        value: fact.value as Record<string, unknown>,
        source: { type: "agent", agentId: ctx.agent.id, reasoning: fact.sourceNote },
        confidence: String(fact.confidence),
        agentId: ctx.agent.id,
        conversationId: ctx.conversationId,
      })
      .returning();

    const superseded = await tx
      .update(schema.facts)
      .set({ supersededBy: row!.id })
      .where(
        and(
          eq(schema.facts.ventureId, ctx.ventureId),
          eq(schema.facts.label, fact.label),
          isNull(schema.facts.supersededBy),
          ne(schema.facts.id, row!.id),
        ),
      )
      .returning({ id: schema.facts.id });

    return { row: row!, supersededCount: superseded.length };
  });

  const note = inserted.supersededCount
    ? ` This replaced ${inserted.supersededCount} earlier fact with the same label; the previous version is retained in the venture's history.`
    : "";

  return {
    content: `Recorded ${fact.kind} "${fact.label}" (id ${inserted.row.id}). It is now part of this venture's context and every agent can see it.${note}`,
    isError: false,
  };
}

function handleComputeModel(input: unknown): ToolOutcome {
  const parsed = AssumptionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: `The assumptions were rejected: ${parsed.error.message}\n\nFix them and call the tool again. Do not compute this by hand.`,
      isError: true,
    };
  }

  const model = computeModel(parsed.data);

  // Hand back the computed statements plus the audit. If a check failed, the
  // model must report that rather than presenting the numbers as clean.
  const failed = model.checks.filter((c) => !c.passed);
  const summary = failed.length
    ? `${failed.length} of 7 validation checks FAILED. Report this to the founder and address it — do not present these figures as validated.`
    : "All 7 validation checks passed.";

  return {
    content: JSON.stringify(
      {
        summary,
        checks: model.checks,
        unitEconomics: model.unitEconomics,
        runwayYears: model.runwayYears === Infinity ? "no cash-out within projection" : model.runwayYears,
        pnl: model.pnl,
        balanceSheet: model.balanceSheet,
        cashFlow: model.cashFlow,
      },
      null,
      1,
    ),
    isError: false,
  };
}
