import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { FACT_KINDS } from "@/lib/agents/types";
import { STAGE_IDS } from "@/lib/stages";

export const stageEnum = pgEnum("stage", STAGE_IDS);
export const factKindEnum = pgEnum("fact_kind", FACT_KINDS);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

/**
 * Tenancy: users belong to orgs, orgs own ventures. Every row below is reachable
 * from an org, which is what row-level security keys off. A solo founder is just
 * an org of one.
 */
export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // References auth.users(id), which Supabase owns. Drizzle doesn't model the
    // auth schema, so this FK is declared in the RLS migration rather than here.
    userId: uuid("user_id").notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("org_members_pk").on(t.orgId, t.userId),
    index("org_members_user_idx").on(t.userId),
  ],
);

export const ventures = pgTable(
  "ventures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    problem: text("problem"),
    industry: text("industry"),
    region: text("region"),
    stage: stageEnum("stage").notNull().default("ideation"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ventures_org_idx").on(t.orgId)],
);

/**
 * Where a fact came from. Every fact carries one, because an unsourced number is
 * how a model ends up in a data room.
 */
export type FactSource =
  | { type: "user"; note?: string }
  | { type: "agent"; agentId: string; reasoning?: string }
  | { type: "web"; url: string; title?: string; accessedAt: string }
  | { type: "document"; documentId: string; page?: number }
  | { type: "computed"; engine: string };

/**
 * The venture's accumulated knowledge — the thing that makes this a platform
 * rather than a chat window.
 *
 * Append-only. Correcting a fact inserts a new row and stamps `supersededBy` on
 * the old one; nothing is ever destroyed. That history is what lets a founder ask
 * "what did we believe about CAC last March, and why did we change our minds?" —
 * which is the actual promise of walking with someone from idea to IPO.
 */
export const facts = pgTable(
  "facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    kind: factKindEnum("kind").notNull(),
    /** Short human/model-readable handle, e.g. "CAC (paid, Freetown)". */
    label: text("label").notNull(),
    /** The content. Shape varies by kind; agents read and write it as JSON. */
    value: jsonb("value").$type<Record<string, unknown>>().notNull(),
    source: jsonb("source").$type<FactSource>().notNull(),
    /** 0..1. Low-confidence facts are compiled into the brief with a warning. */
    confidence: text("confidence").notNull().default("0.7"),
    /** Which agent wrote this, for attribution in the UI. */
    agentId: text("agent_id"),
    conversationId: uuid("conversation_id"),
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The hot path: compile the current brief for one venture.
    index("facts_current_idx")
      .on(t.ventureId, t.kind)
      .where(sql`${t.supersededBy} is null`),
    index("facts_venture_created_idx").on(t.ventureId, t.createdAt),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_venture_idx").on(t.ventureId, t.agentId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    /** Raw Anthropic content blocks. Stored whole so tool calls and citations survive. */
    content: jsonb("content").$type<unknown[]>().notNull(),
    model: text("model"),
    usage: jsonb("usage").$type<Record<string, number>>(),
    /** Turn cost in USD, priced at write time so historical spend stays accurate. */
    costUsd: text("cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/**
 * Real deliverables — an .xlsx that opens, not prose describing one. Versioned,
 * because a Series A model is the seed model plus two years of argument.
 */
export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ventureId: uuid("venture_id")
      .notNull()
      .references(() => ventures.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    version: text("version").notNull().default("1"),
    title: text("title").notNull(),
    /** Path in Supabase Storage. */
    storagePath: text("storage_path"),
    /** For artifacts that are structured data rather than a file (e.g. a computed model). */
    data: jsonb("data").$type<Record<string, unknown>>(),
    agentId: text("agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("artifacts_venture_idx").on(t.ventureId, t.kind)],
);
