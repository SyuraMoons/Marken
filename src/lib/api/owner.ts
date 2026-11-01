import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { isUuid, notFound, unauthorized } from "@/lib/http";

// Every API route must resolve ownership here: the proxy skips /api, and the admin
// client bypasses RLS. Lookups go through the owner's RLS client, so another owner's
// id returns no row and surfaces as 404 (FR-AU-04).

export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];

type Guard<T> = { ok: true; user: CurrentUser; value: T } | { ok: false; response: Response };

export async function getOwnedShop(shopId: string): Promise<Guard<Shop>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: unauthorized() };
  if (!isUuid(shopId)) return { ok: false, response: notFound() };
  const supabase = await createClient();
  const { data } = await supabase.from("shops").select("*").eq("id", shopId).maybeSingle();
  if (!data) return { ok: false, response: notFound() };
  return { ok: true, user, value: data };
}

export async function getOwnedPost(postId: string): Promise<Guard<Post>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, response: unauthorized() };
  if (!isUuid(postId)) return { ok: false, response: notFound() };
  const supabase = await createClient();
  const { data } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!data) return { ok: false, response: notFound() };
  return { ok: true, user, value: data };
}

/** Today's date (YYYY-MM-DD) in the shop's time zone, falling back to UTC. */
export function shopToday(timeZone: string | null, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Start of the shop's current day as an ISO instant. */
export function shopDayStartIso(timeZone: string | null, now = new Date()): string {
  const today = shopToday(timeZone, now);
  // Offset of the zone at `now`, applied to local midnight of today.
  const tz = timeZone ?? "UTC";
  let offsetMin = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(now);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    if (m) offsetMin = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
  } catch {
    offsetMin = 0;
  }
  return new Date(Date.parse(`${today}T00:00:00Z`) - offsetMin * 60_000).toISOString();
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
