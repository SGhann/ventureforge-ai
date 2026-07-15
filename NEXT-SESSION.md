# Pick up here

Written 14 July 2026, end of the rebuild session. Delete this file once you're moving again.

## Where things stand

The foundation is built and pushed to branch **`rebuild/foundation`**. `main` still holds the original v0.1 prototype, untouched, so nothing is lost and you can diff against it.

Verified: `next build` clean, `tsc --noEmit` clean, 16 engine tests passing, auth gating exercised with throwaway credentials.

**Not verified: a single real model turn.** No Anthropic key or Supabase project existed during the build, so the streaming loop, tool execution, and prompt caching are typechecked and correct-by-construction but have never actually run. Treat that as the first job, not an afterthought — it's where surprises live.

## Start of next session, in order

```bash
git checkout rebuild/foundation
npm install                      # node_modules won't survive a new codespace
npm test                         # should print: pass 16, fail 0 — confirms the env is sane
```

Then the blocker: **there is no Supabase project yet.** Nothing runs until there is one.

1. Create a project at supabase.com (a few minutes).
2. `cp .env.example .env.local` and fill in all six values. `.env.example` says where each one comes from in the dashboard. Use the **session pooler** connection string for `DATABASE_URL`, not the direct one.
3. `npm run db:push` to create the tables.
4. Paste `lib/db/migrations/0001_rls.sql` into the Supabase SQL editor and run it. Not optional for multi-tenant.
5. Add `http://localhost:3000/auth/callback` to Supabase → Authentication → URL Configuration.
6. `npm run dev`, sign in by magic link, create a venture through the wizard.
7. Open Market Intelligence and ask it to size your market. **Watch for the tool activity indicators** — if web search fires and the answer carries citations, the architecture is proven end to end. That's the moment to celebrate.

## Traps I already hit, so you don't

- **Don't test on port 3100.** I left a dev server there running with placeholder credentials during the last session; it's killed now, but if you see a stray one, kill it. It fails in confusing ways because it points at a Supabase project that doesn't exist.
- **`npx tsc --noEmit | head` reports the exit code of `head`, not `tsc`.** Don't trust `echo $?` through a pipe. Run `npx tsc --noEmit` bare.
- **Version numbers in package.json were guessed once and were wrong.** If you add a dependency, check the real version with `npm view <pkg> version` first.

## The decisions worth not re-litigating

- **No fallback in the chat route, ever.** The old app silently served canned templates whenever the API failed. Combined with a model ID retired in June 2026, every user got boilerplate while the app looked healthy. Degrade to an error, never to a plausible answer. `README.md` has the detail.
- **`proxy.ts` deliberately does not redirect `/api/*`.** `fetch()` follows redirects, so a redirected `POST /api/chat` returns 200 carrying the sign-in HTML page — `response.ok` is true, the SSE parser finds no frames, and the user gets an empty bubble with no error. Same silent failure, different door.
- **The LLM never does arithmetic.** It picks assumptions; `lib/finance/engine.ts` computes. The seven checks are assertions, not prompt instructions.
- **Model IDs live in exactly one file** (`lib/ai/models.ts`). Keep it that way — that's the whole "won't get stuck in the past" property.

## Then, in rough priority

1. **Artifacts** — wire the finance engine's output into a real `.xlsx` via Agent Skills (`code_execution_20260521` + the `xlsx` skill). This is the promise the old README made and never kept, and the engine output is already shaped for it.
2. **Document upload + retrieval** — pgvector over founder-uploaded files, surfaced as a `document` fact source (the type already exists in the schema).
3. **Spend dashboard** — the data is already written to `messages.cost_usd` on every turn; it just needs a view.
4. **The stage journey** — the longitudinal loop. Only worth building once there's history to walk through.

## Open questions for future you

- The engine is annual-periods-only, no working capital, equity financing only. All documented at the top of `engine.ts`. Fine for SaaS; a fintech with real float will need more. Decide when it bites, not before.
- One conversation per (venture, agent) so context accumulates instead of fragmenting. Multiple named threads is a real feature request, not a bug, when it comes.
- `createVenture` picks the user's oldest org. That's correct while everyone has exactly one; it needs an explicit picker the day orgs get multiple members.
