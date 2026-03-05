# 🔨 VentureForge AI

**From Ideation to IPO — 11 specialist AI agents powered by Claude.**

## Quick Deploy to Vercel (5 minutes)

### Prerequisites
- GitHub account
- Vercel account (free at vercel.com)
- Anthropic API key (from console.anthropic.com)

### Steps

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create ventureforge-ai --private --push
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repo
   - Vercel auto-detects Next.js — no configuration needed
   - Add environment variable:
     - Key: `ANTHROPIC_API_KEY`
     - Value: your `sk-ant-...` key
   - Click Deploy

3. **Done.** Your app is live at `https://ventureforge-ai.vercel.app`

### Local Development
```bash
npm install
cp .env.example .env.local   # Add your API key
npm run dev                   # http://localhost:3000
```

## Architecture

```
Browser (React)
    ↓ POST /api/chat
    ↓ { messages, system }
Vercel Edge Function (route.js)
    ↓ fetch with x-api-key header
    ↓ ANTHROPIC_API_KEY from env
Anthropic API
    ↓ Claude Sonnet response
    ↓ { text, model, usage }
Browser renders markdown
```

**Why this works:**
- API key lives server-side only — never exposed to browser
- No browser proxy, no intermediary — direct server-to-Anthropic call
- Vercel edge functions have <50ms cold start
- Built-in fallback to local response engine if API is unavailable

## Project Structure

```
app/
  api/chat/route.js    ← Server-side API route (calls Anthropic)
  components/
    VentureForge.js    ← Main React app (client component)
  layout.js            ← Root layout, fonts, meta
  page.js              ← Entry point
```

## Cost Estimate

Claude Sonnet pricing (as of 2025):
- Input: $3/M tokens, Output: $15/M tokens
- Average conversation turn: ~500 input + ~800 output tokens
- 100 conversations/day ≈ $1.50/day ≈ $45/month
- Vercel hosting: Free tier covers this easily

## Customization

**Change the AI model:** Edit `app/api/chat/route.js`, line with `model:`
**Add agents:** Add entries to the `AGENTS` array in `VentureForge.js`
**Custom domain:** Add in Vercel dashboard → Settings → Domains
