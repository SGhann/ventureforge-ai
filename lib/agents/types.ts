import type { Effort, ModelTier } from "@/lib/ai/models";

/**
 * The kinds of thing we know about a venture. Every fact in the context store is
 * one of these, and every agent declares which kinds it reads and may write.
 *
 * This is the vocabulary the whole product shares: if Market Intelligence writes
 * a `competitor`, Fundraising can read it when building the pitch deck.
 */
export const FACT_KINDS = [
  "assumption", // A number or premise the model depends on. Always carries a source.
  "competitor",
  "segment", // A customer segment, ideally Jobs-to-be-Done shaped.
  "metric", // An observed value: CAC, churn, MRR, headcount.
  "risk",
  "decision", // A choice the founder made, and why. The audit trail.
  "team",
  "milestone",
  "regulatory",
  "channel",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

/**
 * Tools are declared per agent rather than granted globally. Market Intelligence
 * gets web search; Financial Modeling gets the deterministic engine and must not
 * do arithmetic in prose.
 */
export const TOOL_NAMES = [
  "web_search", // Anthropic server-side search. Real sources, real citations.
  "record_fact", // Write back to the venture context store.
  "compute_financial_model", // Deterministic engine. The model picks assumptions; code does the math.
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type AgentDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  tagline: string;
  /** Shown in the UI. Not sent to the model. */
  description: string;
  /** The agent's expertise. Sent to the model, cached across turns. */
  system: string;
  tier: ModelTier;
  effort: Effort;
  tools: ToolName[];
  /** Which slices of venture context get compiled into this agent's brief. */
  reads: FactKind[];
  /** Which fact kinds this agent is allowed to write. Enforced in the tool handler. */
  writes: FactKind[];
  produces: string[];
  bestFor: string[];
  starterPrompts: string[];
};
