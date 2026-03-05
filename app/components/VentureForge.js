"use client";
import { useState, useEffect, useRef, useMemo } from "react";

// ─── TOKENS ───
const C = {
  bg: "#0a0e17", card: "#111827", hover: "#1a2234", input: "#0d1321",
  border: "#1e293b", text: "#e2e8f0", muted: "#94a3b8", dim: "#64748b",
  accent: "#3b82f6", green: "#10b981", amber: "#f59e0b", red: "#ef4444", purple: "#8b5cf6",
};

// ─── DATA ───
const STAGES = [
  { id: "ideation", label: "Ideation", icon: "💡", color: "#a78bfa", desc: "Validate the opportunity before committing resources", tasks: ["Market sizing (TAM/SAM/SOM)", "Competitive landscape mapping", "Problem validation interviews", "Business model hypothesis"], nextAction: "Start with Market Intelligence to size your opportunity and validate demand." },
  { id: "formation", label: "Formation", icon: "🏗️", color: "#60a5fa", desc: "Create the legal entity and founding agreements", tasks: ["Entity structure selection", "Founder agreements & vesting", "Equity allocation", "IP assignment"], nextAction: "Use Legal & Regulatory to structure your entity and founder agreements." },
  { id: "pre-seed", label: "Pre-Seed", icon: "🌱", color: "#34d399", desc: "Define and fund your minimum viable product", tasks: ["MVP feature definition", "Pre-seed budget ($50K-$500K)", "First pitch deck", "Angel investor targeting"], nextAction: "Product Strategy to define your MVP, then Fundraising to build your pitch." },
  { id: "seed", label: "Seed", icon: "🚀", color: "#fbbf24", desc: "Launch, get traction, and raise institutional capital", tasks: ["Full financial model", "Virtual data room", "Term sheet analysis", "Board structure"], nextAction: "Financial Modeling for your institutional-grade model, then build your data room." },
  { id: "series-a", label: "Series A", icon: "📈", color: "#f97316", desc: "Scale with institutional backing and governance", tasks: ["5-year projection model", "Complete VDR audit", "Due diligence preparation", "Formal governance"], nextAction: "Financial Modeling for 5-year projections and Fundraising for your VDR." },
  { id: "growth", label: "Growth", icon: "⚡", color: "#ec4899", desc: "Expand rapidly across markets and products", tasks: ["Unit economics optimization", "Expansion modeling", "Team scaling plan", "Series B/C preparation"], nextAction: "Marketing for growth strategy and Team & HR for scaling your organization." },
  { id: "ipo", label: "Late / IPO", icon: "🏛️", color: "#ef4444", desc: "Prepare for public offering or strategic exit", tasks: ["Corporate governance overhaul", "S-1 / prospectus preparation", "Audit readiness", "Investor relations function"], nextAction: "Legal & Regulatory for governance and Risk Management for audit readiness." },
];

const AGENTS = [
  { id: "market-intelligence", label: "Market Intelligence", icon: "🔍", color: "#a78bfa",
    tagline: "Know your market before you build",
    desc: "Conducts institutional-grade market research including TAM/SAM/SOM sizing, 5-layer competitive mapping, customer segmentation, and industry trend analysis. Uses both top-down and bottom-up validation to ensure numbers hold up to investor scrutiny.",
    produces: ["Market sizing report", "Competitive landscape map", "Customer segment profiles", "Industry trend analysis"],
    bestFor: ["Validating market opportunity", "Investor-ready market data", "Finding competitive gaps", "Understanding customer needs"],
    prompts: ["Size my market", "Who are my competitors?", "Define customer segments"],
    sys: "You are VentureForge's Market Intelligence Agent. You conduct institutional-grade market research: TAM/SAM/SOM (top-down + bottom-up cross-validation), 5-layer competitive mapping (direct, indirect, substitutes, potential entrants, do-nothing), customer segmentation via Jobs-to-be-Done, and PESTEL + Porter's Five Forces. Always cite methodology, cross-validate numbers, and flag data quality issues. Be specific and data-driven." },
  { id: "financial-modeling", label: "Financial Modeling", icon: "📊", color: "#60a5fa",
    tagline: "Every number traceable, every model auditable",
    desc: "Builds institutional-grade financial models with 7 mandatory validation checks. Catches errors that would embarrass you in due diligence — like the $82.7M retained earnings error found on a real project. Models scale from back-of-napkin to public-company-ready.",
    produces: ["5-year financial model (Excel)", "Unit economics dashboard", "Cap table & dilution model", "Scenario analysis"],
    bestFor: ["Fundraising preparation", "Board presentations", "Strategic planning", "Regulatory submissions"],
    prompts: ["Build a 5-year model", "Calculate unit economics", "Model my cap table"],
    sys: "You are VentureForge's Financial Modeling Agent. You build institutional-grade models where every number traces to labeled assumptions. You run 7 mandatory checks: balance sheet balance, cash reconciliation, retained earnings continuity, positive equity, revenue consistency, unit economics sanity (LTV:CAC > 3:1), and runway. You caught an $82.7M retained earnings error on a real project — you take audit seriously. Use tables for numbers. Be precise." },
  { id: "legal-regulatory", label: "Legal & Regulatory", icon: "⚖️", color: "#34d399",
    tagline: "Navigate compliance with confidence",
    desc: "Helps structure entities, draft founder agreements, and navigate regulatory landscapes. Learned the hard way that banking licenses come from national regulators — not SEZ authorities. Provides frameworks and flags when professional legal review is essential.",
    produces: ["Entity structure recommendation", "Founder agreement framework", "Regulatory roadmap", "Licensing strategy"],
    bestFor: ["Company formation", "Founder equity structuring", "Regulatory pathway planning", "Compliance frameworks"],
    prompts: ["Structure founder equity", "Licensing strategy", "What entity type?"],
    sys: "You are VentureForge's Legal & Regulatory Agent. You help with entity structuring, founder agreements, and regulatory navigation. Key lesson: banking licenses come from national regulators, NOT SEZ authorities. You recommend progressive licensing (PSP → EMI → Full Banking). You structure mixed founder contributions (cash vs IP vs sweat equity) with appropriate vesting. You are NOT a lawyer — always flag when professional legal review is needed." },
  { id: "fundraising-ir", label: "Fundraising & IR", icon: "💰", color: "#fbbf24",
    tagline: "Raise capital at every stage",
    desc: "Creates pitch decks, assembles data rooms, builds investor target lists with fit scoring, and analyzes term sheets to flag red flags. Knows that angels care about team, VCs about unit economics, and strategics about synergies.",
    produces: ["10-slide pitch deck outline", "Virtual data room structure", "Investor target list", "Term sheet analysis"],
    bestFor: ["Preparing to raise", "Pitch practice", "Due diligence preparation", "Evaluating offers"],
    prompts: ["Create a pitch deck outline", "Analyze this term sheet", "Build my data room"],
    sys: "You are VentureForge's Fundraising & IR Agent. You create pitch decks (10-slide framework), assemble virtual data rooms (7-section structure), build investor target lists with fit scoring, and analyze term sheets flagging red flags (full-ratchet anti-dilution, >1x participating preferences, founder vesting restarts). Different audiences need different materials: angels care about team/vision, VCs about unit economics, strategics about synergies." },
  { id: "marketing", label: "Marketing", icon: "📣", color: "#f97316",
    tagline: "Strategy without execution is hallucination",
    desc: "Full-spectrum marketing covering 8 disciplines: content, social media, email/CRM, paid acquisition, PR, brand, community, and growth. Specializes in emerging markets — WhatsApp-first strategies, USSD for non-smartphones, community trust mechanics.",
    produces: ["Content pillar strategy", "Social media plan", "Email sequence architecture", "Referral program design", "PR strategy"],
    bestFor: ["Building brand awareness", "Customer acquisition", "Community building", "Launch campaigns"],
    prompts: ["Content pillar strategy", "Social media plan", "Design a referral program"],
    sys: "You are VentureForge's Marketing Agent covering 8 disciplines: content marketing, social media, email/CRM, paid acquisition, PR & communications, brand management, community building, and growth marketing. Your philosophy: strategy without execution is hallucination, execution without measurement is gambling. Every recommendation includes: action, channel, audience, metric, iteration trigger. You know emerging markets: WhatsApp-first, USSD for non-smartphones, community trust mechanics like digital Osusu." },
  { id: "product-strategy", label: "Product Strategy", icon: "🎯", color: "#ec4899",
    tagline: "Ship the right thing, not everything",
    desc: "Translates business vision into executable product plans. Defines MVPs as the smallest feature set that solves the core problem AND proves the revenue model. Prioritizes features using RICE scoring and builds Now-Next-Later roadmaps.",
    produces: ["MVP definition", "Feature priority matrix (RICE)", "Product roadmap", "PRD templates"],
    bestFor: ["Defining what to build first", "Saying no to feature creep", "Aligning team on priorities", "Planning releases"],
    prompts: ["Define my MVP", "Prioritize features", "Build a product roadmap"],
    sys: "You are VentureForge's Product Strategy Agent. You translate vision into executable plans. MVPs = smallest feature set that solves the core problem AND proves the revenue model. Prioritize with RICE scoring (Reach × Impact × Confidence / Effort). Build Now-Next-Later roadmaps where Later is themes not features. Push back on scope creep. Be opinionated about what to cut." },
  { id: "go-to-market", label: "Go-To-Market", icon: "🗺️", color: "#14b8a6",
    tagline: "WHO → WHERE → HOW → WHEN → HOW MUCH",
    desc: "Designs market entry strategies: identifies target segments, evaluates acquisition channels, crafts positioning, and builds 90-day launch plans. Evaluates channels on reach, cost, speed, control, and customer fit.",
    produces: ["GTM strategy document", "Channel evaluation matrix", "Positioning statement", "90-day launch plan"],
    bestFor: ["Preparing for launch", "Choosing channels", "Pricing strategy", "Market entry planning"],
    prompts: ["Plan my launch", "Channel strategy", "Positioning framework"],
    sys: "You are VentureForge's Go-To-Market Agent. You design market entry: WHO (segments) → WHERE (channels) → HOW (messaging) → WHEN (timing) → HOW MUCH (budget). Evaluate channels on reach, cost, speed, control, fit. Build 90-day launch plans with pre-launch, launch, and post-launch phases. Be specific about tactics, not generic." },
  { id: "risk-management", label: "Risk Management", icon: "🛡️", color: "#ef4444",
    tagline: "What keeps you up at night?",
    desc: "Identifies and mitigates risks across 9 categories: market, financial, operational, regulatory, technology, team, legal, reputational, and macroeconomic. Scores each risk on Probability × Impact and specifies mitigation strategies.",
    produces: ["Risk register (scored)", "Scenario analysis", "Mitigation plan", "Business continuity plan"],
    bestFor: ["Board presentations", "Investor due diligence", "Strategic planning", "Crisis preparation"],
    prompts: ["Identify top risks", "Stress test my model", "Crisis planning"],
    sys: "You are VentureForge's Risk Management Agent. You identify and mitigate risks across 9 categories: market, financial, operational, regulatory, technology, team, legal, reputational, macroeconomic. Score each: Probability (1-5) × Impact (1-5). Classify: LOW (1-4), MEDIUM (5-9), HIGH (10-15), CRITICAL (16-25). For HIGH/CRITICAL: specify avoid, mitigate, transfer, or accept with specific actions." },
  { id: "impact-esg", label: "Impact & ESG", icon: "🌍", color: "#22c55e",
    tagline: "Impact measured with financial rigor",
    desc: "Quantifies social impact alongside financial returns. Builds Theories of Change, ESG frameworks, SDG alignment maps, and impact reports using IRIS+ metrics. Makes impact investable.",
    produces: ["Theory of Change", "SDG alignment map", "Impact metrics dashboard", "ESG report framework"],
    bestFor: ["Impact investor reporting", "Grant applications", "CSR strategy", "Social enterprise planning"],
    prompts: ["Measure my impact", "SDG alignment", "Theory of change"],
    sys: "You are VentureForge's Impact & ESG Agent. You quantify social impact with financial rigor. Build Theories of Change (Inputs → Activities → Outputs → Outcomes → Impact), ESG frameworks, SDG alignment maps, and IRIS+ metrics. Make impact measurable and investable. Balance idealism with pragmatism." },
  { id: "team-hr", label: "Team & HR", icon: "👥", color: "#8b5cf6",
    tagline: "The right people at the right stage",
    desc: "Designs stage-appropriate organizational structures. Creates hiring roadmaps, compensation frameworks (cash at 60-80% market + equity), structured job descriptions, and advisory board strategies.",
    produces: ["Org chart by stage", "24-month hiring plan", "Compensation framework", "Job descriptions"],
    bestFor: ["Planning first hires", "Structuring equity compensation", "Scaling the team", "Advisory board setup"],
    prompts: ["Who should I hire first?", "Compensation framework", "Org design"],
    sys: "You are VentureForge's Team & HR Agent. Design stage-appropriate orgs and build high-performing startup teams. Compensation: cash at 60-80% market + equity (first engineer 1-2%, VP 0.5-1.5%, C-suite 1-3%). Standard vesting: 4 years, 1-year cliff. Create hiring roadmaps and structured JDs. Be practical about startup constraints." },
  { id: "technology", label: "Technology", icon: "⚙️", color: "#06b6d4",
    tagline: "Architecture that grows with you",
    desc: "Designs scalable, secure, cost-effective technology foundations. Selects stacks based on team expertise, ecosystem maturity, and compliance. Architecture evolves: monolith → modular → SOA → microservices.",
    produces: ["Stack recommendation", "Architecture diagram", "Security framework", "Build vs buy analysis"],
    bestFor: ["Choosing technology", "Security planning", "Infrastructure cost modeling", "Technical due diligence"],
    prompts: ["Choose my tech stack", "Architecture design", "Build vs buy?"],
    sys: "You are VentureForge's Technology Architecture Agent. Design scalable, secure, cost-effective foundations. Stack selection: team expertise, ecosystem maturity, scalability, talent availability, cost, compliance. Architecture evolves by stage: monolith → modular → SOA → microservices. Always include security (OAuth 2.0, encryption, API rate limiting) and build-vs-buy analysis. Be pragmatic — ship fast, refactor later." },
];

// ─── MARKDOWN RENDERER ───
function Md({ text }) {
  const renderInline = (s) => {
    const parts = []; let rem = s, k = 0;
    while (rem.length > 0) {
      const bm = rem.match(/\*\*(.+?)\*\*/);
      const cm = rem.match(/`([^`]+)`/);
      let fm = null, ft = null;
      if (bm && (!cm || bm.index <= cm.index)) { fm = bm; ft = "b"; }
      else if (cm) { fm = cm; ft = "c"; }
      if (!fm) { parts.push(rem); break; }
      if (fm.index > 0) parts.push(rem.slice(0, fm.index));
      if (ft === "b") parts.push(<strong key={k++} style={{ color: C.text, fontWeight: 700 }}>{fm[1]}</strong>);
      else parts.push(<code key={k++} style={{ background: C.bg, padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", color: C.accent }}>{fm[1]}</code>);
      rem = rem.slice(fm.index + fm[0].length);
    }
    return parts;
  };
  const lines = text.split("\n");
  const els = []; let tbl = [], inTbl = false;
  const flushTbl = () => {
    if (tbl.length < 2) { tbl.forEach((r, i) => els.push(<p key={els.length + i}>{r}</p>)); }
    else {
      const pr = r => r.split("|").map(c => c.trim()).filter(c => c);
      const h = pr(tbl[0]), rows = tbl.slice(2).map(pr);
      els.push(<div key={els.length} style={{ overflowX: "auto", margin: "8px 0", borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{h.map((c, i) => <th key={i} style={{ padding: "7px 10px", background: C.bg, textAlign: "left", color: C.accent, fontWeight: 700, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{renderInline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ padding: "6px 10px", borderBottom: `1px solid ${C.border}08`, color: C.text, fontSize: 12 }}>{renderInline(c)}</td>)}</tr>)}</tbody>
        </table></div>);
    }
    tbl = []; inTbl = false;
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|")) { inTbl = true; tbl.push(t); return; }
    else if (inTbl) flushTbl();
    if (!t) els.push(<div key={i} style={{ height: 6 }} />);
    else if (t.startsWith("###")) els.push(<div key={i} style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginTop: 10, marginBottom: 3 }}>{renderInline(t.replace(/^#{1,3}\s*/, ""))}</div>);
    else if (t.match(/^[•\-▸]\s/)) els.push(<div key={i} style={{ paddingLeft: 10, margin: "2px 0", display: "flex", gap: 6, alignItems: "flex-start" }}><span style={{ color: C.accent, lineHeight: 1.65 }}>•</span><span style={{ flex: 1 }}>{renderInline(t.replace(/^[•\-▸]\s*/, ""))}</span></div>);
    else if (t.match(/^[✓✅]\s?/)) els.push(<div key={i} style={{ paddingLeft: 10, margin: "2px 0", display: "flex", gap: 6 }}><span style={{ color: C.green }}>✓</span><span style={{ flex: 1 }}>{renderInline(t.replace(/^[✓✅✔]\s*/, ""))}</span></div>);
    else if (t.match(/^🚩\s?/)) els.push(<div key={i} style={{ paddingLeft: 10, margin: "2px 0", display: "flex", gap: 6 }}><span>🚩</span><span style={{ flex: 1 }}>{renderInline(t.replace(/^🚩\s*/, ""))}</span></div>);
    else if (t.match(/^\d+\.\s/)) { const n = t.match(/^(\d+)\./)[1]; els.push(<div key={i} style={{ paddingLeft: 10, margin: "2px 0", display: "flex", gap: 6 }}><span style={{ color: C.accent, fontWeight: 700, minWidth: 16 }}>{n}.</span><span style={{ flex: 1 }}>{renderInline(t.replace(/^\d+\.\s*/, ""))}</span></div>); }
    else els.push(<p key={i} style={{ margin: "3px 0" }}>{renderInline(t)}</p>);
  });
  if (inTbl) flushTbl();
  return <div style={{ fontSize: 13, lineHeight: 1.65, color: C.text }}>{els}</div>;
}

// ─── RESPONSE ENGINE (swap to Claude API in production) ───
function respond(id, q, v, ind, reg, stg) {
  const R = {
    "market-intelligence": [
      { k: ["size", "market", "tam", "sam", "som"], r: `Here's how I'd size the market for **${v}**:\n\n### Top-Down\n- Total population × % addressable × ARPU = **TAM**\n- TAM × % reachable (geography, segment) = **SAM**\n- SAM × realistic share (1-5% Year 1) = **SOM**\n\n### Bottom-Up Validation\n- Reachable customers × Conversion rate × ARPU = SOM\n- Extend upward to cross-validate SAM and TAM\n\nIf top-down and bottom-up differ by >50%, something's wrong. **SOM should never exceed 10% of SAM in Year 1.**\n\n**Next:** Tell me your target customer and pricing, and I'll run the numbers for ${ind} in ${reg}.` },
      { k: ["compet", "rival", "who else", "landscape"], r: `Competitive landscape for **${v}** — 5-Layer framework:\n\n| Layer | Description | Question |\n|-------|------------|----------|\n| 1. Direct | Same product, same market | Who does exactly this in ${reg}? |\n| 2. Indirect | Different product, same problem | What alternatives exist? |\n| 3. Substitutes | Informal / non-digital | Cash systems, manual processes? |\n| 4. Potential Entrants | Adjacent well-funded players | Who could pivot into this? |\n| 5. Do Nothing | Status quo | Why would customers NOT adopt? |\n\nFor each competitor, I'll map: product, pricing, funding, market share, strengths, weaknesses.\n\n**Who are the players you already know about?**` },
      { k: ["segment", "customer", "persona", "target"], r: `Customer segmentation for **${v}** using **Jobs-to-be-Done:**\n\n| Dimension | Question |\n|-----------|----------|\n| WHO | Demographics, firmographics |\n| WHAT | What job are they hiring ${v} to do? |\n| WHY | What pain is severe enough to pay for? |\n| HOW MUCH | Willingness to pay |\n| HOW MANY | Segment size |\n| PRIORITY | Pain × Size × Accessibility |\n\nFor **${ind}** in **${reg}**, likely primary segments:\n- Early adopters (tech-savvy, underserved)\n- Price-sensitive mass market\n- SMEs needing operational tools\n- Diaspora with cross-border needs\n\n**Which resonates? Tell me about customers you've spoken to.**` },
    ],
    "financial-modeling": [
      { k: ["5 year", "5-year", "model", "projection", "build"], r: `Model architecture for **${v}:**\n\n### 10-Sheet Structure\n1. Cover & Contents\n2. Assumptions (color-coded, scenario toggles)\n3. Revenue Model (customers × ARPU)\n4. Cost Model (personnel, tech, marketing, ops)\n5. P&L (Revenue → EBITDA → Net Income)\n6. Balance Sheet (must balance every period)\n7. Cash Flow Statement\n8. Unit Economics (CAC, LTV, payback)\n9. Cap Table & Funding\n10. Scenarios & Sensitivity\n\n### 7 Validation Checks\n✓ Balance sheet balances ($0 tolerance)\n✓ Cash flow reconciliation\n✓ Retained earnings continuity\n✓ Equity stays positive\n✓ LTV:CAC > 3:1\n✓ Runway calculated accurately\n✓ Revenue ties to white paper\n\n**What's your revenue model?** Subscription, transaction fees, or lending?` },
      { k: ["unit econ", "cac", "ltv", "payback"], r: `Unit economics for **${v}:**\n\n### Key Formulas\n- **CAC** = Total acquisition spend ÷ New customers\n- **LTV** = ARPU × Gross Margin × Avg Lifespan\n- **LTV:CAC** — Target > 3:1, flag if < 2:1\n- **Payback** — Target < 12 months\n\n### ${ind} Benchmarks\n| Metric | Typical Range |\n|--------|---------------|\n| CAC | $5-20 organic, $30-100+ paid |\n| LTV:CAC | 3-5:1 healthy |\n| Payback | 6-18 months |\n| Gross Margin | >40% software, >20% fintech |\n\n**I need:** Your pricing, churn rate, cost to serve, and channels.` },
      { k: ["cap table", "equity", "dilution"], r: `Cap table for **${v}:**\n\n### Dilution by Round\n| Round | Typical Dilution | Raise Range |\n|-------|-----------------|-------------|\n| Pre-Seed | 10-20% | $250K-$1M |\n| Seed | 15-25% | $1M-$5M |\n| Series A | 20-30% | $5M-$25M |\n| Series B+ | 15-25% | $25M+ |\n\n### Key Mechanics\n- **ESOP:** Reserve 10-15% at formation\n- **Vesting:** 4-year, 1-year cliff standard\n- **Mixed contributions:** Cash (immediate) vs IP (milestone) vs Sweat (time-based)\n\nTell me about your founding team and any funding so far.` },
    ],
    "legal-regulatory": [
      { k: ["equity", "founder", "split", "vest"], r: `Founder equity framework for **${v}:**\n\n### Contribution Types\n- **Cash** — $X invested = $X equity. Immediate vesting common.\n- **IP** — Needs valuation. Milestone-based vesting recommended.\n- **Sweat Equity** — 4-year vesting, 1-year cliff. Value = salary equivalent.\n\n### Recommended Structure\nDifferent vesting triggers by contribution:\n- Cash founders: vest on capital deployment\n- IP founders: vest on delivery milestones\n- All: additional time-based component\n\n### Documents Required\n1. Founders' Agreement\n2. Shareholders' Agreement\n3. Vesting Schedules\n4. IP Assignment\n\n⚠️ **Get professional legal review** before signing any of these.` },
      { k: ["licen", "regulat", "compliance", "bank"], r: `Regulatory pathway for **${v}:**\n\n**Critical Lesson:** Always verify WHO grants licenses. Banking licenses come from **national regulators**, not SEZ authorities.\n\n### Progressive Licensing\n| Step | License | Enables | Barrier |\n|------|---------|---------|----------|\n| 1 | PSP | Payments, transfers | Low |\n| 2 | EMI | E-money issuance | Medium |\n| 3 | Full Banking | All services | High |\n\n**Strategy:** Start PSP → generate revenue → demonstrate compliance → pursue fuller licenses. Each milestone signals credibility to investors.\n\nWhat jurisdiction? I'll map specific requirements.` },
      { k: ["entity", "incorporat", "company"], r: `Entity structure for **${v}:**\n\n### Decision Framework\n- **Seeking VC?** → Delaware C-Corp (US investors expect this)\n- **UK/EU ops?** → Ltd Company\n- **Multi-jurisdiction?** → Holding + Operating entities\n- **Regulated?** → Consult regulator FIRST on structure\n- **SEZ?** → Understand what it grants (tax) vs doesn't (licenses)\n\n⚠️ **Structure is hard to change later.** Get legal counsel before incorporating.\n\nWhat investors are you targeting?` },
    ],
    "fundraising-ir": [
      { k: ["pitch", "deck", "slide"], r: `Pitch deck for **${v}:**\n\n### 10-Slide Structure\n| # | Slide | Content | Time |\n|---|-------|---------|------|\n| 1 | Cover | ${v}, tagline | 10s |\n| 2 | Problem | Pain point + evidence | 60s |\n| 3 | Solution | Your approach | 60s |\n| 4 | Market | TAM/SAM/SOM | 45s |\n| 5 | Business Model | Revenue mechanics | 45s |\n| 6 | Traction | Metrics, proof points | 60s |\n| 7 | Competition | Why you win | 45s |\n| 8 | Team | Why THIS team | 45s |\n| 9 | Financials | Projections, unit econ | 60s |\n| 10 | Ask | Amount, use, milestones | 30s |\n\n### Audience Emphasis\n- **Angels** → team, vision, early traction\n- **VCs** → unit economics, scalability\n- **Strategic** → synergies\n- **Impact** → social outcomes\n\nWho's your primary audience?` },
      { k: ["term sheet", "terms", "valuation"], r: `Term sheet analysis for **${v}:**\n\n### Standard Terms (Fair)\n✓ 1x non-participating liquidation preference\n✓ Broad-based weighted average anti-dilution\n✓ 30-60 day no-shop period\n✓ Pro-rata follow-on rights\n\n### Red Flags\n🚩 Full-ratchet anti-dilution\n🚩 >1x participating preference (double-dipping)\n🚩 Investor majority board control at seed\n🚩 Founder vesting restart\n🚩 Exclusivity >90 days\n\nHave you received a term sheet? Share terms and I'll analyze.` },
      { k: ["data room", "vdr", "due diligence"], r: `Data room for **${v}:**\n\n### VDR — 7 Sections\n1. **Company** — Exec summary, deck, org chart\n2. **Financial** — Model, cap table, unit economics\n3. **Legal** — Incorporation, agreements, IP\n4. **Product** — Roadmap, architecture, demo\n5. **Market** — Research, competitive analysis\n6. **Team** — Bios, hiring plan, ESOP\n7. **Regulatory** — Licenses, compliance framework\n\nAt **${stg}** stage, prioritize sections 1, 2, 5, and 6 first.\n\nWhat documents do you already have?` },
    ],
    "marketing": [
      { k: ["content", "pillar", "blog", "seo"], r: `Content strategy for **${v}:**\n\n### 5 Content Pillars\n- **Education** — "How to..." guides for your customers\n- **Innovation** — Thought leadership on ${ind} trends\n- **Stories** — Customer success and case studies\n- **Behind the Build** — Transparent founder journey\n- **Impact** — How ${v} creates broader value\n\n### Cadence for ${stg} Stage\n| Type | Frequency |\n|------|----------|\n| Blog posts | 2-4/month |\n| Social | 3-5/week |\n| Newsletter | 1-2/month |\n| Long-form | 1/month |\n\n### SEO\nCluster keywords by intent: informational → commercial → transactional. Prioritize by **volume × relevance × difficulty.**\n\nWant me to develop specific topics?` },
      { k: ["social", "media", "whatsapp", "facebook", "instagram"], r: `Social strategy for **${v}:**\n\n### Platform Priority for ${reg}\n| Platform | Priority | Best For |\n|----------|----------|----------|\n| WhatsApp | 🟢 Primary | Community, support, broadcasts |\n| Facebook | 🟢 Primary | Reach, groups, marketplace |\n| LinkedIn | 🟡 Secondary | Thought leadership, B2B |\n| Instagram | 🟡 Secondary | Brand storytelling |\n| X/Twitter | 🔵 Tertiary | PR, industry commentary |\n| TikTok | 🔵 Tertiary | Youth, viral potential |\n\n### Weekly Rhythm\n- **Mon:** Educational\n- **Tue:** Product tip\n- **Wed:** Community spotlight\n- **Thu:** Industry commentary\n- **Fri:** Behind the scenes\n\n**Targets:** Engagement >3%, growth 5-10% MoM` },
      { k: ["referral", "viral", "growth", "acquisition"], r: `Growth program for **${v}:**\n\n### Referral Design\n- **Two-sided rewards** (2-3x better than one-sided)\n- Reward on **activation** not just sign-up\n- **Frictionless sharing** — pre-written WhatsApp message\n- **Progress visibility** — "3 invited, 2 more for bonus!"\n\n### Growth Loops\n- **Acquisition:** Discover → Value → Share → New user\n- **Viral:** Use product → Recipient needs account → Signs up\n- **Engagement:** Action → Reward → Return\n\n### Economics\n- Referral CAC must be < paid CAC\n- Referred users have ~25% higher LTV\n- Target: 20-30% of users from referrals\n\nWant me to design specific mechanics?` },
    ],
    "product-strategy": [
      { k: ["mvp", "minimum", "viable", "first", "build"], r: `MVP for **${v}:**\n\n### The Rule\nSmallest feature set that:\n1. Solves the core problem\n2. Proves the revenue model\n3. Creates enough value users would miss it\n4. Ships in 3-6 months\n\n### MoSCoW\n- **Must Have (MVP):** Core value, onboarding, payments, security\n- **Should Have (v1.1):** Secondary features, analytics, notifications\n- **Could Have (v2):** Customization, integrations\n- **Won't Have:** Be ruthless here\n\n**What core problem does ${v} solve?** I'll help draw the line.` },
      { k: ["priorit", "feature", "roadmap", "rice"], r: `Feature prioritization for **${v}:**\n\n### RICE Scoring\n**Score = (Reach × Impact × Confidence) / Effort**\n\n| Factor | Scale |\n|--------|-------|\n| Reach | % customers (1-100%) |\n| Impact | 0.25 / 0.5 / 1 / 2 / 3 |\n| Confidence | 20-100% |\n| Effort | Person-months |\n\n### Now-Next-Later\n- 🟢 **Now (0-3mo):** Committed, building\n- 🟡 **Next (3-6mo):** Planned, scoped\n- 🔵 **Later (6-12mo):** Themes only\n\n**List your top features** and I'll score them.` },
    ],
    "go-to-market": [
      { k: ["launch", "enter", "strategy", "plan", "channel", "position"], r: `GTM for **${v}:**\n\n### Framework: WHO → WHERE → HOW → WHEN\n\n**Positioning:** *"For [target] who [need], ${v} is a [category] that [benefit]. Unlike [competitors], we [differentiator]."*\n\n### 90-Day Launch Plan\n| Phase | Timeline | Activities |\n|-------|----------|------------|\n| Prep | Day -60 to -30 | Beta, content, PR prep |\n| Pre-launch | Day -30 to 0 | Waitlist, influencer seeding |\n| Launch | Day 0 | PR push, social blitz, paid ads |\n| Post-launch | Day 0-30 | Iterate on feedback |\n| Scale | Day 30-90 | Double down on what works |\n\nWhich section should we develop in detail?` },
    ],
    "risk-management": [
      { k: ["risk", "identify", "top", "stress", "crisis"], r: `Risk assessment for **${v}:**\n\n### Risk Register\n| Category | Risk | Score |\n|----------|------|-------|\n| 🔴 Market | Demand not proven | P3 × I5 = 15 |\n| 🔴 Financial | Runway too short | P3 × I5 = 15 |\n| 🟡 Regulatory | License delays | P4 × I3 = 12 |\n| 🟡 Technology | Security breach | P2 × I5 = 10 |\n| 🟡 Operational | Can't execute | P3 × I3 = 9 |\n| 🟢 Team | Key person leaves | P2 × I4 = 8 |\n| 🟢 Reputational | Trust erosion | P2 × I3 = 6 |\n\n### Scoring\n- **1-4:** LOW (Monitor)\n- **5-9:** MEDIUM (Mitigate)\n- **10-15:** HIGH (Urgent)\n- **16-25:** CRITICAL\n\nWant me to build mitigation plans for the HIGH risks?` },
    ],
    "impact-esg": [
      { k: ["impact", "social", "sdg", "esg", "theory", "measure"], r: `Impact framework for **${v}:**\n\n### Theory of Change\n💰 Investment → 🔧 Build → 📊 Outputs → 🎯 Outcomes → 🌍 Impact\n\n### SDG Alignment\n- **SDG 1:** No Poverty — financial access\n- **SDG 8:** Decent Work — jobs, entrepreneurship\n- **SDG 9:** Innovation — infrastructure\n- **SDG 10:** Reduced Inequalities — inclusion\n\n### Metrics\n- Unbanked customers served\n- Income increase for customers\n- Jobs created (direct + indirect)\n- SMEs supported\n- Gender inclusion rate\n\nWant the full Theory of Change with measurable indicators?` },
    ],
    "team-hr": [
      { k: ["hire", "team", "org", "who", "first", "compensation", "salary"], r: `Team plan for **${v}** at **${stg}:**\n\n### Team Size by Stage\n| Stage | Size | Key Hires |\n|-------|------|----------|\n| Pre-Seed | 2-4 | Co-founders only |\n| Seed | 5-15 | Engineers, first sales |\n| Series A | 15-40 | VP Eng, VP Sales, Head of Product |\n| Growth | 40-150 | C-suite, directors |\n\n### Compensation\n- Cash: **60-80%** of market\n- Equity: Engineer 1-2%, VP 0.5-1.5%, C-suite 1-3%\n- Vesting: 4 years, 1-year cliff\n\n### First 5 Hires\n1. CTO / Lead Engineer\n2. Senior Developer\n3. Head of Ops/Compliance\n4. Growth/Marketing Lead\n5. Customer Success\n\nWho's currently on your team?` },
    ],
    "technology": [
      { k: ["stack", "tech", "architect", "build", "buy", "security"], r: `Technology for **${v}:**\n\n### Architecture by Stage\n| Stage | Pattern | Rationale |\n|-------|---------|----------|\n| MVP | Monolith | Ship fast |\n| Seed | Modular monolith | Separate concerns |\n| Series A | Service-oriented | Scale components |\n| Growth | Microservices | Team autonomy |\n\n### Build vs Buy\n- **BUILD:** Core differentiator\n- **BUY:** Commodity functions\n- **OPEN SOURCE:** Community + customization\n\n### Security Baseline\n- OAuth 2.0 + MFA\n- Encryption at rest and transit\n- API rate limiting\n- PCI-DSS if payments\n- SOC 2 by Series A\n\nWhat's your team's technical background?` },
    ],
  };
  const a = R[id]; if (!a) return `Tell me about **${v}** and how I can help.`;
  for (const p of a) if (p.k.some(k => q.includes(k))) return p.r;
  const fb = { "market-intelligence": "market sizing, competitive mapping, or customer segmentation", "financial-modeling": "financial models, unit economics, or cap tables", "legal-regulatory": "entity structure, founder agreements, or regulatory strategy", "fundraising-ir": "pitch decks, data rooms, or term sheet analysis", "marketing": "content, social media, email, paid ads, PR, or referral programs", "product-strategy": "MVP definition, feature prioritization, or product roadmaps", "go-to-market": "launch planning, channel strategy, or positioning", "risk-management": "risk identification, scenario planning, or crisis preparation", "impact-esg": "impact measurement, SDG alignment, or ESG frameworks", "team-hr": "hiring plans, compensation, or org design", "technology": "stack selection, architecture, or security frameworks" };
  return `I'm ready to help **${v}** with ${fb[id] || "your business challenges"}.\n\nTry asking about specific topics, or use the suggested prompts above. The more detail you give me about your situation, the more specific and actionable my advice will be.`;
}

// ─── TYPING INDICATOR ───
function Dots() {
  const [d, setD] = useState(""); useEffect(() => { const i = setInterval(() => setD(x => x.length >= 3 ? "" : x + "."), 350); return () => clearInterval(i); }, []);
  return <span style={{ color: C.muted, fontSize: 13 }}>Thinking{d}</span>;
}

// ─── CHAT ───
function Chat({ agent, venture, onBack }) {
  const [msgs, setMsgs] = useState([]); const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const endRef = useRef(null); const inputRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => { setMsgs([]); inputRef.current?.focus(); }, [agent.id]);

  const send = async (txt) => {
    const msg = (txt || input || "").trim(); if (!msg || loading) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user", content: msg }];
    setMsgs(newMsgs); setLoading(true);

    // Build conversation for API
    const ventureCtx = [venture.name, venture.industry, venture.region].filter(Boolean).join(", ");
    const systemPrompt = agent.sys + (ventureCtx ? `\n\nThe user's venture: ${venture.name || "unnamed"} — ${venture.problem || venture.industry || "unspecified"}. Industry: ${venture.industry || "unspecified"}. Region: ${venture.region || "unspecified"}. Stage: ${venture.stage}. Tailor all advice to this specific context. Use markdown formatting: **bold** for emphasis, ### for headings, tables with | pipes |, and - for bullet points.` : "\n\nThe user hasn't described their venture yet. Ask about it to give tailored advice. Use markdown formatting: **bold** for emphasis, ### for headings, tables with | pipes |, and - for bullet points.");

    const apiMessages = newMsgs.map(m => ({ role: m.role, content: m.content }));

    let reply = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
      const data = await res.json();
      if (data.text) {
        reply = data.text;
      }
    } catch (e) {
      // Silent fallback to local engine
    }

    // If API failed or returned nothing, use local engine
    if (!reply) {
      reply = respond(agent.id, msg.toLowerCase(), venture.name || "your venture", venture.industry || "your industry", venture.region || "your region", venture.stage);
    }

    setMsgs(p => [...p, { role: "assistant", content: reply }]);
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>‹</button>
        <span style={{ fontSize: 18 }}>{agent.icon}</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: agent.color }}>{agent.label}</div></div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 8px" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{agent.icon}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{agent.tagline}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {agent.prompts.map(q => (
                <button key={q} onClick={() => send(q)} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.target.style.borderColor = agent.color; e.target.style.color = agent.color; }}
                  onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: m.role === "user" ? "80%" : "96%", padding: m.role === "user" ? "8px 14px" : "12px 14px", borderRadius: 14, background: m.role === "user" ? C.accent + "22" : C.card, border: `1px solid ${m.role === "user" ? C.accent + "33" : C.border}` }}>
              {m.role === "user" ? <span style={{ fontSize: 13, color: C.text }}>{m.content}</span> : <Md text={m.content} />}
            </div>
          </div>
        ))}
        {loading && <div style={{ padding: "10px 14px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, width: "fit-content" }}><Dots /></div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), send(input))}
            placeholder={`Message ${agent.label}...`} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.input, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}
            onFocus={e => e.target.style.borderColor = agent.color} onBlur={e => e.target.style.borderColor = C.border} />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} style={{ width: 40, height: 40, borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.35 : 1, fontFamily: "inherit", flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ─── AGENT DETAIL ───
function AgentDetail({ agent, onChat, venture }) {
  return (
    <div style={{ padding: "20px 16px", overflowY: "auto", height: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{agent.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: agent.color }}>{agent.label}</div>
        <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 4 }}>{agent.tagline}</div>
      </div>
      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, marginBottom: 20 }}>{agent.desc}</p>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>What it produces</div>
        {agent.produces.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
            <span style={{ color: C.green, fontSize: 12 }}>✓</span>
            <span style={{ fontSize: 12, color: C.text }}>{p}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Best for</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {agent.bestFor.map((b, i) => (
            <span key={i} style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, background: agent.color + "15", color: agent.color, border: `1px solid ${agent.color}25` }}>{b}</span>
          ))}
        </div>
      </div>
      <button onClick={onChat} style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${agent.color}, ${agent.color}cc)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        Start Conversation →
      </button>
    </div>
  );
}

// ─── ONBOARDING WIZARD ───
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: "", problem: "", industry: "", region: "", stage: "ideation" });

  const steps = [
    { q: "What's the name of your venture?", sub: "Don't have one yet? A working title is fine.", field: "name", placeholder: "e.g., Sherbro Digital Bank" },
    { q: "What problem are you solving?", sub: "In one or two sentences — who has the pain and what is it?", field: "problem", placeholder: "e.g., 80% of Sierra Leoneans lack access to formal banking", multiline: true },
    { q: "What industry are you in?", sub: "This helps me tailor benchmarks, regulations, and competitive analysis.", field: "industry", placeholder: "e.g., Fintech, SaaS, Biotech, E-commerce" },
    { q: "Where's your target market?", sub: "Region, country, or city — the more specific the better.", field: "region", placeholder: "e.g., West Africa, United Kingdom, US East Coast" },
    { q: "Where are you in the journey?", sub: "This determines which agents and actions I prioritize for you.", field: "stage", type: "stage" },
  ];

  const s = steps[step];
  const canNext = s.type === "stage" || data[s.field]?.trim();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 4, marginBottom: 32 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.accent : C.border, transition: "background 0.3s" }} />
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Step {step + 1} of {steps.length}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", lineHeight: 1.3 }}>{s.q}</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 24px" }}>{s.sub}</p>

        {s.type === "stage" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STAGES.map(st => (
              <button key={st.id} onClick={() => setData(d => ({ ...d, stage: st.id }))}
                style={{ padding: "12px 14px", borderRadius: 10, border: data.stage === st.id ? `2px solid ${st.color}` : `1px solid ${C.border}`, background: data.stage === st.id ? st.color + "15" : C.card, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                <span style={{ fontSize: 20 }}>{st.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: data.stage === st.id ? st.color : C.text }}>{st.label}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{st.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : s.multiline ? (
          <textarea value={data[s.field]} onChange={e => setData(d => ({ ...d, [s.field]: e.target.value }))} placeholder={s.placeholder} rows={3} autoFocus
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.input, color: C.text, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical" }}
            onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
        ) : (
          <input value={data[s.field]} onChange={e => setData(d => ({ ...d, [s.field]: e.target.value }))} placeholder={s.placeholder} autoFocus
            onKeyDown={e => e.key === "Enter" && canNext && (step < steps.length - 1 ? setStep(step + 1) : onComplete(data))}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.input, color: C.text, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = C.accent} onBlur={e => e.target.style.borderColor = C.border} />
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} style={{ padding: "12px 20px", borderRadius: 10, border: `1px solid ${C.border}`, background: "none", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Back</button>}
          <button onClick={() => step < steps.length - 1 ? setStep(step + 1) : onComplete(data)} disabled={!canNext}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: canNext ? C.accent : C.border, color: canNext ? "#fff" : C.dim, fontSize: 14, fontWeight: 700, cursor: canNext ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {step < steps.length - 1 ? "Continue" : "Launch Dashboard →"}
          </button>
        </div>

        {step === 0 && <button onClick={() => onComplete({ name: "", problem: "", industry: "", region: "", stage: "ideation" })} style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Skip setup — explore first</button>}
      </div>
    </div>
  );
}

// ─── MAIN APP ───
export default function VentureForge() {
  const [page, setPage] = useState("landing"); // landing | onboarding | app
  const [venture, setVenture] = useState({ name: "", problem: "", industry: "", region: "", stage: "ideation" });
  const [view, setView] = useState("home"); // home | agentDetail | chat
  const [activeAgent, setActiveAgent] = useState(null);

  const currentStage = STAGES.find(s => s.id === venture.stage) || STAGES[0];
  const stageIdx = STAGES.findIndex(s => s.id === venture.stage);

  // ─── LANDING ───
  if (page === "landing") return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px 28px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 24 }}>🔨</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VentureForge</span>
          <span style={{ padding: "2px 7px", borderRadius: 99, fontSize: 9, fontWeight: 700, background: C.green + "22", color: C.green }}>AI</span>
        </div>
        <h1 style={{ fontSize: "clamp(26px, 6vw, 40px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 12px" }}>
          From idea to IPO,{" "}<span style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.purple}, ${C.green})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>guided by AI</span>
        </h1>
        <p style={{ fontSize: 14, color: C.muted, maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.6 }}>11 specialist agents help you research markets, model finances, navigate regulations, raise capital, and scale — at institutional quality.</p>
        <button onClick={() => setPage("onboarding")} style={{ padding: "13px 32px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.accent}, #2563eb)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Get Started Free →</button>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 28px", display: "flex", gap: 5, overflowX: "auto" }}>
        {STAGES.map(s => <div key={s.id} style={{ flex: "0 0 auto", padding: "8px 12px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, textAlign: "center", minWidth: 72 }}><div style={{ fontSize: 18 }}>{s.icon}</div><div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div></div>)}
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {AGENTS.map(a => <div key={a.id} style={{ padding: "10px", borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>{a.icon}</span><div><div style={{ fontSize: 11, fontWeight: 700, color: a.color }}>{a.label}</div><div style={{ fontSize: 9, color: C.dim }}>{a.desc}</div></div></div>)}
        </div>
      </div>
    </div>
  );

  // ─── ONBOARDING ───
  if (page === "onboarding") return <Onboarding onComplete={(d) => { setVenture(d); setPage("app"); }} />;

  // ─── APP: HOME / AGENT DETAIL / CHAT ───
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.text, fontFamily: "'DM Sans', system-ui, sans-serif", overflow: "hidden" }}>
      {view === "chat" && activeAgent ? (
        <Chat agent={activeAgent} venture={venture} onBack={() => setView("agentDetail")} />
      ) : view === "agentDetail" && activeAgent ? (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setView("home"); setActiveAgent(null); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer", padding: "0 4px" }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Agent Detail</span>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <AgentDetail agent={activeAgent} venture={venture} onChat={() => setView("chat")} />
          </div>
        </div>
      ) : (
        /* ─── HOME DASHBOARD ─── */
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          {/* Top */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}>🔨</span>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VentureForge</span>
            </div>
            <button onClick={() => setPage("landing")} style={{ background: "none", border: "none", color: C.dim, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Logout</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {/* Venture Summary */}
            <div style={{ padding: 16, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{venture.name || "Your Venture"}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{[venture.industry, venture.region].filter(Boolean).join(" · ") || "Define your venture to get personalized guidance"}</div>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: currentStage.color + "20", color: currentStage.color, border: `1px solid ${currentStage.color}30` }}>{currentStage.icon} {currentStage.label}</span>
              </div>
              {venture.problem && <p style={{ fontSize: 12, color: C.muted, margin: "4px 0 0", lineHeight: 1.5 }}>{venture.problem}</p>}
            </div>

            {/* Stage Progress */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                {STAGES.map((s, i) => (
                  <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= stageIdx ? currentStage.color : C.border, transition: "background 0.3s" }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: C.dim }}>{currentStage.label} — {currentStage.desc}</div>
            </div>

            {/* Next Action */}
            <div style={{ padding: 14, borderRadius: 10, background: C.accent + "0c", border: `1px solid ${C.accent}20`, marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>💡 Recommended Next</div>
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{currentStage.nextAction}</div>
            </div>

            {/* Stage Tasks */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>{currentStage.icon} {currentStage.label} Checklist</div>
              {currentStage.tasks.map((t, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                  <input type="checkbox" style={{ accentColor: currentStage.color, width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: C.text }}>{t}</span>
                </label>
              ))}
            </div>

            {/* Agents */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>Specialist Agents</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingBottom: 20 }}>
              {AGENTS.map(a => (
                <button key={a.id} onClick={() => { setActiveAgent(a); setView("agentDetail"); }}
                  style={{ padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = a.color + "55"} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.4 }}>{a.tagline}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
