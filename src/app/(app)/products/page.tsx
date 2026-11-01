import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProductsView } from "@/components/products-view";
import { getProducts } from "@/lib/data/products";
import { getOwnerShop } from "@/lib/data/today";

// Products grid + add/check/edit/delete flows (DX-07, DX-09, DX-27).
export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-white" />}>
      <Products />
    </Suspense>
  );
}

async function Products() {
  const owner = await getOwnerShop();
  if (!owner) redirect("/login");
  return <ProductsView shopId={owner.shop.id} products={await getProducts(owner.shop.id)} />;
}
