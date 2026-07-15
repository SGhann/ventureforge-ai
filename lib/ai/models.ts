/**
 * Single source of truth for which model we talk to and how.
 *
 * Nothing else in the codebase names a model ID, an effort level, or a thinking
 * config. When a new model ships, this file is the diff.
 */

/** Effort trades thoroughness against latency and token spend. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ModelTier = "flagship" | "balanced" | "fast";

/**
 * Tiers, not model IDs, are what the rest of the app asks for. An agent says "I
 * need the flagship"; it never says "I need claude-opus-4-8".
 */
export const MODEL_IDS: Record<ModelTier, string> = {
  flagship: "claude-opus-4-8",
  balanced: "claude-sonnet-5",
  fast: "claude-haiku-4-5",
};

export const DEFAULT_TIER: ModelTier = "flagship";

/**
 * Published per-million-token rates, used by the usage meter to price a turn.
 * Cache reads bill at ~0.1x input and cache writes at ~1.25x, which is why the
 * system prompt and venture brief are cached — see buildRequest below.
 */
export const PRICING: Record<ModelTier, { inputPerMTok: number; outputPerMTok: number }> = {
  flagship: { inputPerMTok: 5, outputPerMTok: 25 },
  balanced: { inputPerMTok: 3, outputPerMTok: 15 },
  fast: { inputPerMTok: 1, outputPerMTok: 5 },
};

export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * Streaming is not optional above ~16k max_tokens — non-streaming requests hit
 * SDK HTTP timeouts. Every agent turn streams, so we size for headroom.
 */
export const MAX_TOKENS = 32_000;

export function modelIdFor(tier: ModelTier = DEFAULT_TIER): string {
  return MODEL_IDS[tier];
}

export type UsageLike = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

/** Cost of one turn in USD, accounting for cache read/write rates. */
export function priceTurn(tier: ModelTier, usage: UsageLike): number {
  const { inputPerMTok, outputPerMTok } = PRICING[tier];
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;

  const inputCost =
    (usage.input_tokens * inputPerMTok +
      cacheRead * inputPerMTok * CACHE_READ_MULTIPLIER +
      cacheWrite * inputPerMTok * CACHE_WRITE_MULTIPLIER) /
    1_000_000;
  const outputCost = (usage.output_tokens * outputPerMTok) / 1_000_000;

  return inputCost + outputCost;
}
