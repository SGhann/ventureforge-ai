// app/api/chat/route.ts
// This runs SERVER-SIDE on Vercel. No browser proxy. Direct Anthropic API call.
// The ANTHROPIC_API_KEY env var is set in Vercel dashboard, never exposed to the client.

export async function POST(request) {
  try {
    const { messages, system } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "messages array required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: system || "",
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: data.error?.message || "Anthropic API error", type: data.error?.type },
        { status: response.status }
      );
    }

    // Extract text from response
    const text = data.content
      ?.map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    return Response.json({ text, model: data.model, usage: data.usage });
  } catch (err) {
    return Response.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}
