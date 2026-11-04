import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/instagram";
import { findActiveShop } from "@/lib/supabase/active-shop";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// Starts Instagram OAuth (FR-OB-06, F-12). Browser navigation only: the proxy skips /api,
// so the session is checked here. `state` binds the callback to this browser (CSRF).
const STATE_COOKIE = "ig_oauth";

const RETURN_TO = { onboarding: "/onboarding/4", settings: "/settings" } as const;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  // The company is fixed now, so switching company during the Instagram round trip cannot misfile the token.
  const { shop } = await findActiveShop(await createClient(), user.id);
  if (!shop) return NextResponse.redirect(new URL("/login", req.url));

  const next = new URL(req.url).searchParams.get("next") === "settings" ? "settings" : "onboarding";
  const state = randomBytes(24).toString("base64url");

  let location: string;
  try {
    location = authorizeUrl(state);
  } catch (e) {
    console.error("instagram connect unavailable", e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL(`${RETURN_TO[next]}?ig=error`, req.url));
  }

  (await cookies()).set(STATE_COOKIE, `${state}.${next}.${shop.id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // the return trip from instagram.com is a top-level GET
    path: "/api/auth/instagram",
    maxAge: 600,
  });
  return NextResponse.redirect(location);
}
