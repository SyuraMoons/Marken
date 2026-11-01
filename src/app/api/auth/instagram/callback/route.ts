import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectShop } from "@/lib/instagram";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// Instagram OAuth callback (FR-OB-06, FR-PB-05): verifies state, stores the encrypted
// long-lived token and the connected account, then returns to where the owner started.
const STATE_COOKIE = "ig_oauth";
const RETURN_TO = { onboarding: "/onboarding/4", settings: "/settings" } as const;

function sameState(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const [cookieState = "", next = ""] = (jar.get(STATE_COOKIE)?.value ?? "").split(".");
  jar.delete({ name: STATE_COOKIE, path: "/api/auth/instagram" });

  const back = (ig: "connected" | "error") =>
    NextResponse.redirect(new URL(`${next === "settings" ? RETURN_TO.settings : RETURN_TO.onboarding}?ig=${ig}`, req.url));

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code");
  // The owner declined, or the state does not match the one this browser started with.
  if (url.searchParams.has("error") || !code || !cookieState || !sameState(state, cookieState)) return back("error");

  const supabase = await createClient();
  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (!shop) return back("error");

  try {
    await connectShop(shop.id, code);
  } catch (e) {
    console.error("instagram connect failed", e instanceof Error ? e.message : e);
    return back("error");
  }
  return back("connected");
}
