import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, unauthorized } from "@/lib/http";

// Create the owner's shop, or return the existing one (one shop per owner).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const supabase = await createClient();
  const existing = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing.error) return apiError("shop_lookup_failed", 500);
  if (existing.data) return Response.json({ shop: existing.data });

  const created = await supabase
    .from("shops")
    .insert({ owner_id: user.id })
    .select("*")
    .single();
  if (created.error) {
    // Lost a race with a parallel request: the unique owner_id row now exists.
    if (created.error.code === "23505") {
      const again = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (again.data) return Response.json({ shop: again.data });
    }
    return apiError("shop_create_failed", 500);
  }
  return Response.json({ shop: created.data }, { status: 201 });
}
