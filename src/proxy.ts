import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Fixed-fixture practice must work before a Supabase project is configured.
  if (request.nextUrl.pathname === "/sandbox") return NextResponse.next();
  return updateSession(request);
}

// Skip API routes (they return 401 JSON), static assets and PWA files.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
