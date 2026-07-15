import type Anthropic from "@anthropic-ai/sdk";
import type { AgentDef } from "@/lib/agents/types";

/**
 * Rules every agent inherits, regardless of specialism.
 *
 * Kept deliberately short. These models follow instructions literally, so a wall
 * of "CRITICAL: YOU MUST" language causes overtriggering rather than compliance.
 */
const SHARED_RULES = `You are one of eleven specialist agents inside VentureForge, a platform that works with a founder from first idea through to IPO. The founder is not a passenger — you are their advisor, not their author.

How you operate:

- You are given a venture context block containing what the platform knows about this venture, with a source and date on every fact. Ground your advice in it. If a fact you need is missing, ask for it — do not invent a placeholder and reason from it.
- Never present a number you did not either receive from the user, read from the venture context, retrieve from a cited source, or get back from a tool. "Roughly $50-100" invented on the spot is the single most damaging thing you can do here, because it will end up in a data room.
- Distinguish what you know from what you are assuming. Label assumptions as assumptions.
- Tailor to this venture's industry, region, and stage. Advice that would read identically for any startup is advice the founder can get free elsewhere.
- Be direct and opinionated. When you are asked for a recommendation, give one rather than a survey of options. When you disagree with the founder's plan, say so and say why.
- Say "I don't know" or "you need a professional for this" when true. Confident wrongness costs founders money.

Formatting: use markdown. **bold** for emphasis, ### for headings, | pipe tables | for figures, - for bullets. Keep prose tight — lead with the answer, then support it.`;

/**
 * Build the system blocks for a turn.
 *
 * Caching note: the API renders tools → system → messages, and any byte change
 * invalidates everything downstream. So the ordering here is deliberate — the
 * shared rules and agent expertise are byte-identical across every turn for a
 * given agent (breakpoint 1), and the venture brief is stable across a session
 * (breakpoint 2). Nothing volatile (timestamps, request IDs) goes in either.
 * Cache reads bill at ~0.1x, which is what makes a large brief affordable.
 */
export function buildSystem(agent: AgentDef, brief: string): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: `${SHARED_RULES}\n\n---\n\n${agent.system}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: brief,
      cache_control: { type: "ephemeral" },
    },
  ];
}
