import { getOwnedShop } from "@/lib/api/owner";
import { apiError } from "@/lib/http";
import { setActiveShop } from "@/lib/supabase/active-shop";
import { createClient } from "@/lib/supabase/server";

// Switch company (SRD v2.1 A-12). Allowed while onboarding is unfinished, so an owner who started
// a new company can always go back to another one.
export async function POST(_req: Request, ctx: RouteContext<"/api/shops/[id]/activate">) {
  const { id } = await ctx.params;
  const guard = await getOwnedShop(id, { requireActive: false });
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  if (!(await setActiveShop(supabase, guard.user.id, guard.value.id))) return apiError("shop_switch_failed", 500);
  return Response.json({ active: guard.value.id });
}
