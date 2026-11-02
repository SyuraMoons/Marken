import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

// Session refresh + routing for src/proxy.ts (FR-AU-04, FR-LP-03).

function destinationFor(
  shop: { onboarding_step: number; onboarding_completed_at: string | null } | null,
) {
  if (shop?.onboarding_completed_at) return "/today";
  return `/onboarding/${shop?.onboarding_step ?? 1}`;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          cacheHeaders = headers ?? {};
          for (const [k, v] of Object.entries(cacheHeaders)) response.headers.set(k, v);
        },
      },
    },
  );

  // Nothing may run between client creation and getClaims().
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  const { pathname, search, searchParams } = request.nextUrl;

  // Redirects must carry the refreshed cookies and cache headers.
  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    for (const [k, v] of Object.entries(cacheHeaders)) res.headers.set(k, v);
    return res;
  };

  // Supabase falls back to the Site URL when a redirect isn't allow-listed, and
  // the landing page would ignore the result, leaving the owner signed out.
  if (pathname === "/" && (searchParams.has("code") || searchParams.has("error_code"))) {
    return redirectTo(`/auth/callback${search}`);
  }

  const isPublic = pathname === "/" || pathname === "/login" || pathname === "/example";
  const isAuthRoute = pathname.startsWith("/auth/");

  if (!userId) {
    if (isPublic || isAuthRoute) return response;
    return redirectTo("/login");
  }

  if (pathname === "/" || pathname === "/login") {
    const { data: shop, error } = await supabase
      .from("shops")
      .select("onboarding_step, onboarding_completed_at")
      .eq("owner_id", userId)
      .maybeSingle();
    // On a query failure stay put rather than send an existing owner back to step 1.
    if (error) return response;
    return redirectTo(destinationFor(shop));
  }

  // Signed-in owners with unfinished setup land on their saved step, not on the app (FR-OB-11).
  if (!pathname.startsWith("/onboarding") && !isAuthRoute) {
    const { data: shop, error } = await supabase
      .from("shops")
      .select("onboarding_step, onboarding_completed_at")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!error && !shop?.onboarding_completed_at) return redirectTo(destinationFor(shop));
  }

  return response;
}
