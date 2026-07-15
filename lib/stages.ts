/**
 * The journey. Stages drive which agents get recommended, which checklist shows,
 * and how a venture's history reads back later.
 */
export const STAGE_IDS = [
  "ideation",
  "formation",
  "pre-seed",
  "seed",
  "series-a",
  "growth",
  "ipo",
] as const;

export type StageId = (typeof STAGE_IDS)[number];

export type Stage = {
  id: StageId;
  label: string;
  icon: string;
  color: string;
  description: string;
  tasks: string[];
  /** Which agents matter most here — drives the "recommended next" nudge. */
  recommendedAgents: string[];
  nextAction: string;
};

export const STAGES: Stage[] = [
  {
    id: "ideation",
    label: "Ideation",
    icon: "💡",
    color: "#a78bfa",
    description: "Validate the opportunity before committing resources",
    tasks: [
      "Market sizing (TAM/SAM/SOM)",
      "Competitive landscape mapping",
      "Problem validation interviews",
      "Business model hypothesis",
    ],
    recommendedAgents: ["market-intelligence", "product-strategy"],
    nextAction:
      "Start with Market Intelligence to size your opportunity and validate demand.",
  },
  {
    id: "formation",
    label: "Formation",
    icon: "🏗️",
    color: "#60a5fa",
    description: "Create the legal entity and founding agreements",
    tasks: [
      "Entity structure selection",
      "Founder agreements & vesting",
      "Equity allocation",
      "IP assignment",
    ],
    recommendedAgents: ["legal-regulatory", "team-hr"],
    nextAction: "Use Legal & Regulatory to structure your entity and founder agreements.",
  },
  {
    id: "pre-seed",
    label: "Pre-Seed",
    icon: "🌱",
    color: "#34d399",
    description: "Define and fund your minimum viable product",
    tasks: [
      "MVP feature definition",
      "Pre-seed budget ($50K-$500K)",
      "First pitch deck",
      "Angel investor targeting",
    ],
    recommendedAgents: ["product-strategy", "fundraising-ir", "technology"],
    nextAction: "Product Strategy to define your MVP, then Fundraising to build your pitch.",
  },
  {
    id: "seed",
    label: "Seed",
    icon: "🚀",
    color: "#fbbf24",
    description: "Launch, get traction, and raise institutional capital",
    tasks: [
      "Full financial model",
      "Virtual data room",
      "Term sheet analysis",
      "Board structure",
    ],
    recommendedAgents: ["financial-modeling", "fundraising-ir", "go-to-market"],
    nextAction:
      "Financial Modeling for your institutional-grade model, then build your data room.",
  },
  {
    id: "series-a",
    label: "Series A",
    icon: "📈",
    color: "#f97316",
    description: "Scale with institutional backing and governance",
    tasks: [
      "5-year projection model",
      "Complete VDR audit",
      "Due diligence preparation",
      "Formal governance",
    ],
    recommendedAgents: ["financial-modeling", "fundraising-ir", "risk-management"],
    nextAction: "Financial Modeling for 5-year projections and Fundraising for your VDR.",
  },
  {
    id: "growth",
    label: "Growth",
    icon: "⚡",
    color: "#ec4899",
    description: "Expand rapidly across markets and products",
    tasks: [
      "Unit economics optimization",
      "Expansion modeling",
      "Team scaling plan",
      "Series B/C preparation",
    ],
    recommendedAgents: ["marketing", "team-hr", "financial-modeling"],
    nextAction: "Marketing for growth strategy and Team & HR for scaling your organization.",
  },
  {
    id: "ipo",
    label: "Late / IPO",
    icon: "🏛️",
    color: "#ef4444",
    description: "Prepare for public offering or strategic exit",
    tasks: [
      "Corporate governance overhaul",
      "S-1 / prospectus preparation",
      "Audit readiness",
      "Investor relations function",
    ],
    recommendedAgents: ["legal-regulatory", "risk-management", "fundraising-ir"],
    nextAction: "Legal & Regulatory for governance and Risk Management for audit readiness.",
  },
];

const BY_ID = new Map(STAGES.map((s) => [s.id, s]));

export function getStage(id: StageId): Stage {
  const stage = BY_ID.get(id);
  if (!stage) throw new Error(`Unknown stage: ${id}`);
  return stage;
}

export function stageIndex(id: StageId): number {
  return STAGE_IDS.indexOf(id);
}
