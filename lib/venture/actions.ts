"use server";

import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { STAGE_IDS } from "@/lib/stages";

const CreateVentureSchema = z.object({
  name: z.string().trim().min(1, "Give your venture a name.").max(120),
  problem: z.string().trim().max(2000).optional(),
  industry: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  stage: z.enum(STAGE_IDS),
});

export type CreateVentureInput = z.infer<typeof CreateVentureSchema>;

export type CreateVentureResult = { error: string };

/**
 * Create a venture in the caller's org.
 *
 * Server action, so treat every input as hostile — this runs with the Drizzle
 * client, which bypasses row-level security. The org is resolved from the
 * session rather than accepted from the client; taking an orgId from the form
 * would let anyone write a venture into someone else's workspace.
 *
 * Returns on failure, redirects on success (a redirect throws, so there's no
 * success return path).
 */
export async function createVenture(
  _previous: CreateVentureResult | null,
  formData: FormData,
): Promise<CreateVentureResult> {
  const user = await requireUser();

  const parsed = CreateVentureSchema.safeParse({
    name: formData.get("name"),
    problem: formData.get("problem") || undefined,
    industry: formData.get("industry") || undefined,
    region: formData.get("region") || undefined,
    stage: formData.get("stage"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your answers." };
  }

  const database = db();

  // Oldest membership wins — that's the org the sign-in flow created for them.
  // Once orgs can have several members and a user can belong to several, this
  // becomes an explicit picker in the wizard.
  const membership = await database
    .select({ orgId: schema.orgMembers.orgId })
    .from(schema.orgMembers)
    .where(eq(schema.orgMembers.userId, user.id))
    .orderBy(asc(schema.orgMembers.createdAt))
    .limit(1);

  const orgId = membership[0]?.orgId;
  if (!orgId) {
    // Sign-in creates the org, so this means state we didn't expect. Don't
    // paper over it by silently creating one here — that's how duplicate orgs
    // and orphaned ventures happen.
    return { error: "Your workspace is missing. Sign out and back in, and tell us if it persists." };
  }

  const [venture] = await database
    .insert(schema.ventures)
    .values({
      orgId,
      name: parsed.data.name,
      problem: parsed.data.problem ?? null,
      industry: parsed.data.industry ?? null,
      region: parsed.data.region ?? null,
      stage: parsed.data.stage,
    })
    .returning();

  redirect(`/ventures/${venture!.id}`);
}
