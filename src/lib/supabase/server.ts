import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";

// Cookie-based client for Server Components, route handlers and server actions.
// Acts as the signed-in owner, so RLS applies.
export async function createClient() {
  const cookieStore = await cookies();
  // With cacheComponents + partialPrefetching, cookies resolve during prerender, and supabase-js then reads
  // Date.now() (token expiry in getClaims). That fails the page's Suspense boundary and reloads it in a loop,
  // so every owner-scoped read waits for the real request.
  await connection();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: the proxy refreshes sessions instead.
          }
        },
      },
    },
  );
}
