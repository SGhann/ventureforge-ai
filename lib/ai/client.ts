import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * The Anthropic client, constructed once per server process.
 *
 * Throws at call time rather than module load so a missing key surfaces as a
 * handled request error instead of crashing the whole server on boot.
 */
export function anthropic(): Anthropic {
  if (cached) return cached;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ConfigError(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }

  cached = new Anthropic();
  return cached;
}

/** A deployment/config problem, not a model problem. Surfaced to operators, not blamed on the user. */
export class ConfigError extends Error {
  readonly kind = "config" as const;
}
