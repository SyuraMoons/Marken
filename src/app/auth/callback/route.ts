import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth and magic link (PKCE): exchange the code for a session. The proxy
// picks the destination from "/", so there is no `next` parameter to abuse.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  // Supabase sends expired or already-used email links back here without a code.
  if (searchParams.get("error_code") === "otp_expired") {
    return NextResponse.redirect(`${origin}/login?error=link`);
  }
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=generic`);
}
