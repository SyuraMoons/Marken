import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreateFlow } from "@/components/create-flow";
import { getBrandKit } from "@/lib/data/brand-kit";
import { getProducts } from "@/lib/data/products";
import { getOwnerShop } from "@/lib/data/today";

// Generate image post: brief → brand kit → review, and only then the job starts (FD-46).
export default function CreatePage({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-white" />}>
      <Create searchParams={searchParams} />
    </Suspense>
  );
}

async function Create({ searchParams }: Pick<PageProps<"/create">, "searchParams">) {
  const owner = await getOwnerShop();
  if (!owner) redirect("/login");
  const { product } = await searchParams;
  const [products, kit] = await Promise.all([getProducts(owner.shop.id), getBrandKit(owner.shop.id)]);
  const ready = products.filter((p) => p.cutout_confirmed && !p.hidden);
  const picked = ready.find((p) => p.id === product) ?? ready[0];
  if (!picked) redirect("/products");
  return (
    <CreateFlow
      shopId={owner.shop.id}
      product={{ id: picked.id, name: picked.name, cutoutUrl: picked.cutout_url }}
      savedKit={kit}
      hasDescription={!!owner.shop.description?.trim()}
    />
  );
}
