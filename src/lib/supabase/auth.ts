import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type CurrentUser = { id: string; email: string | null; provider: string | null };

// Verified user for this request (JWT checked via getClaims, not spoofable cookies).
// Every API route must call this: the proxy skips /api.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const provider = data.claims.app_metadata?.provider;
  return {
    id: data.claims.sub,
    provider: typeof provider === "string" ? provider : null,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
