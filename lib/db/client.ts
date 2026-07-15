import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Drizzle over the Supabase Postgres.
 *
 * This connects as the database owner and therefore BYPASSES row-level security.
 * Only use it where tenancy has already been checked — every query through this
 * client must be scoped by an orgId or ventureId that `assertVentureAccess` has
 * already verified for the current user. For anything user-driven and unchecked,
 * go through the Supabase client instead, which carries the user's JWT and gets
 * RLS enforced for free.
 */
export function db() {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  // prepare: false is required for Supabase's transaction pooler.
  const client = postgres(url, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
