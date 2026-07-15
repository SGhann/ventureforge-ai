import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { supabaseServer } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";

/**
 * Magic-link landing. Exchanges the code for a session, then makes sure the user
 * has an org — every user needs one, because tenancy hangs off it and a solo
 * founder is just an org of one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/sign-in?error=Missing+sign-in+code", url.origin));
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`, url.origin),
    );
  }

  await ensureOrg(data.user.id, data.user.email);

  return NextResponse.redirect(new URL(next, url.origin));
}

async function ensureOrg(userId: string, email?: string) {
  const database = db();

  const existing = await database.query.orgMembers.findFirst({
    where: eq(schema.orgMembers.userId, userId),
  });
  if (existing) return;

  await database.transaction(async (tx) => {
    // Re-check inside the transaction: two magic-link clicks racing would
    // otherwise create two orgs for one user, and the venture they create next
    // would land in whichever one won.
    const raced = await tx
      .select({ orgId: schema.orgMembers.orgId })
      .from(schema.orgMembers)
      .where(eq(schema.orgMembers.userId, userId))
      .limit(1);
    if (raced.length > 0) return;

    const [org] = await tx
      .insert(schema.orgs)
      .values({ name: email ? `${email.split("@")[0]}'s workspace` : "My workspace" })
      .returning();

    await tx.insert(schema.orgMembers).values({
      orgId: org!.id,
      userId,
      role: "owner",
    });
  });
}
