# 🔨 VentureForge AI

**From ideation to IPO — eleven specialist agents that remember your venture.**

## What makes this different from a chatbot with good prompts

Three things, and they're the whole product:

**It remembers.** Everything an agent establishes — a competitor, a segment, an assumption, a risk — is written to the venture context store with its source and date. Every other agent reads it. Market Intelligence finds your competitors in March; Fundraising uses them to build your deck in June. Facts are append-only: correcting one supersedes it rather than overwriting it, so you can always ask *what did we believe last quarter, and why did we change our minds?*

**It computes rather than claims.** The Financial Modeling agent does not do arithmetic. It chooses assumptions — which is judgment, and where its expertise is real — then calls a deterministic engine (`lib/finance/engine.ts`) that computes the P&L, balance sheet, cash flow, and unit economics, and runs seven validation checks as actual assertions. A model that doesn't balance throws. It cannot report that it balanced.

**It fails loudly.** There is no fallback path. If the model call fails, you see an error. See "The silent fallback" below — this is not a small detail.

## Architecture

```
Browser (React 19)
    │  POST /api/chat  { conversationId, message }
    ▼
Next.js route (app/api/chat/route.ts)
    │  1. authenticate + assert venture access   ← lib/auth.ts
    │  2. rehydrate conversation from Postgres
    │  3. compile venture brief from facts       ← lib/venture/context.ts
    │  4. build cached system prompt             ← lib/ai/prompt.ts
    │  5. stream turn, run tool loop             ← lib/ai/tools.ts
    ▼
Anthropic API (@anthropic-ai/sdk)
    │  tools: web_search · record_fact · compute_financial_model
    ▼
SSE stream back to browser (text · thinking · tool activity · errors)
```

### Layers

| Layer | Where | Why it exists |
|---|---|---|
| Model config | `lib/ai/models.ts` | The **only** file that names a model ID. A new model is a one-line diff. |
| Agent registry | `lib/agents/registry.ts` | Agents are data, not code. A twelfth agent is a new entry — no app changes. |
| Venture context store | `lib/db/schema.ts`, `lib/venture/context.ts` | The moat. Model-agnostic, append-only, sourced. |
| Tools | `lib/ai/tools.ts` | Where agents get real capability instead of describing capability. |
| Financial engine | `lib/finance/engine.ts` | Deterministic. Tested. The LLM never touches the arithmetic. |
| Tenancy | `lib/auth.ts` + `lib/db/migrations/0001_rls.sql` | App-level check first, row-level security as the backstop. |

**Upgrading the model** means editing `MODEL_IDS` in `lib/ai/models.ts`. That's the point — the venture's accumulated knowledge, the artifacts, the stage logic, and the domain expertise in the agent prompts don't know or care which model is behind them.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then:

```bash
cp .env.example .env.local   # fill in from Project Settings → API and → Database
npm install
npm run db:push              # create the tables
```

Then apply row-level security — **not optional for a multi-tenant deployment**. Paste `lib/db/migrations/0001_rls.sql` into the Supabase SQL editor and run it.

### 2. Anthropic

Get a key at [console.anthropic.com](https://console.anthropic.com) and set `ANTHROPIC_API_KEY` in `.env.local`.

### 3. Run

```bash
npm run dev        # http://localhost:3000
npm test           # financial engine test suite
npm run typecheck
```

Sign-in is magic-link. Add `http://localhost:3000/auth/callback` to your Supabase redirect allowlist (Authentication → URL Configuration).

## Deploy

Vercel auto-detects Next.js. Set `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `NEXT_PUBLIC_SITE_URL`. Use the **session pooler** connection string for `DATABASE_URL` — serverless functions exhaust direct connections.

## Cost

Opus 4.8 is $5/M input, $25/M output. The system prompt and venture brief are cached with `cache_control`, so repeat turns bill the cached prefix at roughly one tenth of the input rate. That is what makes carrying a large venture brief on every turn affordable — without caching, this architecture would be expensive rather than just good.

Per-turn cost is priced at write time and stored on every message row (`messages.cost_usd`), so spend per venture is a query rather than an estimate.

## The silent fallback

The previous version had a keyword-matching template engine that the client silently fell back to whenever the API call failed:

```js
// old app/components/VentureForge.js
if (data.text) reply = data.text;
// ...
if (!reply) reply = respond(agent.id, msg.toLowerCase(), ...);  // canned templates
```

Combined with a model ID pinned to `claude-sonnet-4-20250514` — past its announced retirement — every request would 404 and every user would silently receive pre-written boilerplate with their venture name interpolated in. The app looked like it worked.

There is no fallback in this version, and there should never be one. An advisor that says "I'm broken" is worth more than one that improvises confidently, because the entire product rests on a founder being able to trust what comes back. If you are ever tempted to add a graceful degradation path here: don't. Degrade to an error.

## Status

**Built:** foundation — TypeScript, Postgres schema, magic-link auth + RLS, model layer, agent registry (all 11 ported), venture context store, prompt caching, streaming chat with tool loop, deterministic financial engine (16 tests passing), web search, fact recording, onboarding wizard, venture dashboard and picker.

**Verified:** builds clean, typechecks clean, 16 engine tests pass. Public pages render, auth gating redirects pages and returns JSON 401s for API routes. **The live model path has not been exercised against a real key** — the streaming loop and tool execution are typechecked but not yet observed end to end.

**Next:** artifact generation (real .xlsx/.docx/.pptx via Agent Skills), document upload and retrieval over venture files, the longitudinal stage journey, per-venture spend dashboard (the data is already on `messages.cost_usd`).

## A note on API routes and the proxy

`proxy.ts` deliberately does **not** redirect `/api/*` when unauthenticated — it lets each route return its own JSON 401. This matters: `fetch()` follows redirects transparently, so a redirected `POST /api/chat` would come back to the client as a 200 carrying the sign-in HTML page. `response.ok` would be true, the SSE parser would find no frames in the HTML, and the user would get an empty answer and no error — the silent fallback, reintroduced by accident. The client also checks `content-type` before parsing, as a second line of defence. Don't remove either.
