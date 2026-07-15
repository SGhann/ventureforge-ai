import { createServerClient } from "@supabase/ssr";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db/client";
import type { Venture } from "@/lib/venture/context";

/**
 * Supabase client bound to the caller's session cookie. Queries through this
 * client carry the user's JWT, so row-level security applies.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
}

export type SessionUser = { id: string; email?: string };

export async function getUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer();
  // getUser() revalidates the JWT with Supabase. getSession() only reads the
  // cookie and trusts it, which is forgeable — never use it for authorization.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new UnauthorizedError("Not signed in.");
  return user;
}

export class UnauthorizedError extends Error {}

/**
 * The tenancy gate.
 *
 * Returns the venture only if this user is a member of the org that owns it.
 * Everything that reaches the venture context store must pass through here first,
 * because the Drizzle client connects as the database owner and bypasses RLS —
 * RLS is the second line of defence, not the first.
 *
 * Returns null rather than throwing on a miss, and callers return 404 rather than
 * 403: telling a stranger "this venture exists but isn't yours" leaks the fact
 * that it exists.
 */
export async function assertVentureAccess(
  userId: string,
  ventureId: string,
): Promise<Venture | null> {
  const rows = await db()
    .select({ venture: schema.ventures })
    .from(schema.ventures)
    .innerJoin(schema.orgMembers, eq(schema.orgMembers.orgId, schema.ventures.orgId))
    .where(and(eq(schema.ventures.id, ventureId), eq(schema.orgMembers.userId, userId)))
    .limit(1);

  return rows[0]?.venture ?? null;
}
