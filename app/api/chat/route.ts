import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgent } from "@/lib/agents/registry";
import { anthropic, ConfigError } from "@/lib/ai/client";
import { MAX_TOKENS, modelIdFor, priceTurn } from "@/lib/ai/models";
import { buildSystem } from "@/lib/ai/prompt";
import { executeTool, toolDefsFor } from "@/lib/ai/tools";
import { assertVentureAccess, requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { briefFor } from "@/lib/venture/context";

export const runtime = "nodejs";
// Agent turns run tools and can take minutes. Don't let the platform cut them off.
export const maxDuration = 300;

const RequestSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(20_000),
});

/**
 * One agent turn, streamed.
 *
 * NOTE ON ERROR HANDLING — this is deliberate, and it is the single most
 * important behavioural difference from the previous version of this app.
 *
 * The old client did `if (data.text) { reply = data.text }` and, on any failure,
 * silently fell back to a canned keyword-matched template. When the pinned model
 * was retired, every request 404'd and every user got boilerplate — and nothing
 * anywhere said so. The app looked like it worked for as long as nobody read the
 * output closely.
 *
 * So: there is no fallback here. If the model call fails, the failure reaches the
 * user as a failure. An advisor that says "I'm broken" is worth more than one
 * that improvises confidently, because the whole product rests on the founder
 * being able to trust what comes back.
 */
export async function POST(request: Request) {
  // Authenticate before validating. An anonymous caller has no business learning
  // the shape of our request schema from the error messages.
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const database = db();

  const conversation = await database.query.conversations.findFirst({
    where: eq(schema.conversations.id, body.conversationId),
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const venture = await assertVentureAccess(user.id, conversation.ventureId);
  if (!venture) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const agent = requireAgent(conversation.agentId);

  // Rehydrate the conversation. The API is stateless; the durable record is ours.
  const history = await database.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversation.id),
    orderBy: schema.messages.createdAt,
  });

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content as Anthropic.ContentBlockParam[],
  }));
  messages.push({ role: "user", content: body.message });

  await database.insert(schema.messages).values({
    conversationId: conversation.id,
    role: "user",
    content: [{ type: "text", text: body.message }],
  });

  const brief = await briefFor(venture, agent.reads);
  const system = buildSystem(agent, brief);
  const tools = toolDefsFor(agent);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const client = anthropic();
        let turns = 0;
        // Bound the tool loop. An agent that has called tools 12 times without
        // reaching an answer is stuck, and should say so rather than spend the
        // founder's money in a circle.
        const MAX_TOOL_TURNS = 12;

        while (turns < MAX_TOOL_TURNS) {
          turns++;

          const response = await client.messages.stream({
            model: modelIdFor(agent.tier),
            max_tokens: MAX_TOKENS,
            system,
            messages,
            tools: tools.length ? tools : undefined,
            thinking: { type: "adaptive", display: "summarized" },
            output_config: { effort: agent.effort },
          });

          for await (const event of response) {
            if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                send("text", { text: event.delta.text });
              } else if (event.delta.type === "thinking_delta") {
                send("thinking", { text: event.delta.thinking });
              }
            } else if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                send("tool_start", { name: event.content_block.name });
              } else if (event.content_block.type === "server_tool_use") {
                send("tool_start", { name: event.content_block.name });
              }
            }
          }

          const message = await response.finalMessage();

          await database.insert(schema.messages).values({
            conversationId: conversation.id,
            role: "assistant",
            content: message.content,
            model: message.model,
            usage: message.usage as unknown as Record<string, number>,
            costUsd: String(priceTurn(agent.tier, message.usage)),
          });

          messages.push({ role: "assistant", content: message.content });

          // The model was declined by a safety classifier. Say so plainly.
          if (message.stop_reason === "refusal") {
            send("error", {
              message:
                "The model declined this request. If you believe that's wrong, rephrase and try again.",
            });
            break;
          }

          // Server-side tools hit their internal iteration cap; resume by re-sending.
          if (message.stop_reason === "pause_turn") {
            continue;
          }

          const toolUses = message.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );

          if (toolUses.length === 0) {
            send("done", { stopReason: message.stop_reason });
            break;
          }

          // Execute every requested tool, then return all results in ONE user
          // message — splitting them across messages teaches the model to stop
          // calling tools in parallel.
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            const outcome = await executeTool(toolUse.name, toolUse.input, {
              ventureId: venture.id,
              conversationId: conversation.id,
              agent,
            });
            send("tool_result", { name: toolUse.name, isError: outcome.isError });
            results.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: outcome.content,
              is_error: outcome.isError,
            });
          }

          messages.push({ role: "user", content: results });
          await database.insert(schema.messages).values({
            conversationId: conversation.id,
            role: "user",
            content: results,
          });

          if (turns === MAX_TOOL_TURNS) {
            send("error", {
              message:
                "This agent used its full tool budget without reaching an answer. That's a bug on our side, not a limit on your question — please retry, and tell us if it keeps happening.",
            });
          }
        }
      } catch (error) {
        // No silent fallback. Ever. See the note at the top of this file.
        console.error("[chat] turn failed", {
          conversationId: conversation.id,
          agentId: agent.id,
          error,
        });

        send("error", { message: describeFailure(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Turn an exception into something a founder can act on. Operators get the stack
 * in the logs; the user gets a sentence that tells them whose problem it is.
 */
function describeFailure(error: unknown): string {
  if (error instanceof ConfigError) {
    return "VentureForge is misconfigured and can't reach the model. This is our problem, not yours — we've logged it.";
  }

  const status = (error as { status?: number })?.status;
  switch (status) {
    case 401:
    case 403:
      return "VentureForge couldn't authenticate with the model provider. We've logged it — this is on us.";
    case 404:
      return "The configured model no longer exists. We've logged it; this needs a deploy to fix.";
    case 429:
      return "We're being rate limited right now. Wait a moment and try again.";
    case 529:
      return "The model provider is overloaded. Try again shortly.";
    default:
      return status && status >= 500
        ? "The model provider had an error. Try again shortly."
        : `The request failed: ${error instanceof Error ? error.message : "unknown error"}`;
  }
}
