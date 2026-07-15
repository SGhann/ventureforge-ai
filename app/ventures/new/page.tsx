import { OnboardingWizard } from "@/components/OnboardingWizard";
import { requireUser } from "@/lib/auth";

export default async function NewVenturePage() {
  // The proxy already gates this route, but the action runs with an
  // RLS-bypassing client — so re-establish the session here rather than
  // trusting an upstream check.
  await requireUser();
  return <OnboardingWizard />;
}
