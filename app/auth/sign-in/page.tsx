import { redirect } from "next/navigation";
import { getUser, supabaseServer } from "@/lib/auth";

/**
 * Magic-link sign-in. No passwords to store, reset, or leak.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (user) redirect("/");

  async function signIn(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    if (!email) redirect("/auth/sign-in?error=Enter+your+email+address");

    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
      },
    });

    if (error) {
      redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/auth/sign-in?sent=1");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔨</div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Sign in to VentureForge</h1>
        </div>

        {params.sent ? (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: "color-mix(in srgb, var(--green) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--green)" }}>Check your email.</strong> We sent you a sign-in
            link. It expires in an hour.
          </div>
        ) : (
          <form action={signIn} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {params.error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "color-mix(in srgb, var(--red) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
                  fontSize: 12,
                  color: "var(--text)",
                }}
              >
                {params.error}
              </div>
            )}
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@company.com"
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--input)",
                color: "var(--text)",
                fontSize: 15,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: 12,
                borderRadius: 10,
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Email me a sign-in link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
