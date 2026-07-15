import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request.
 *
 * Server Components can't write cookies, so without this the access token
 * silently expires and users get logged out mid-conversation.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Revalidates the token and rotates cookies as a side effect. Must not be
  // removed — and must be getUser(), not getSession(): getSession trusts the
  // cookie without checking it with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API routes must never be redirected to an HTML page. fetch() follows
  // redirects transparently, so a redirected POST /api/chat would arrive back at
  // the client as a 200 carrying the sign-in page — response.ok true, body
  // present, and the SSE parser would chew through HTML finding no frames and
  // report nothing. The user gets an empty bubble and no error.
  //
  // So: let API requests through and let each route answer for itself with a
  // JSON 401. Every route under /api authenticates independently; the gate below
  // is for pages only.
  if (pathname.startsWith("/api/")) return response;

  const isPublic = pathname === "/" || pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
