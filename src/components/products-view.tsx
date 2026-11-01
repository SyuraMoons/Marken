"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteProduct, saveProduct, setCutoutConfirmed } from "@/lib/actions/products";
import type { ProductView } from "@/lib/data/products";
import { t } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/options";
import { ACCEPT, uploadAndExtract, validPhoto } from "@/lib/upload";
import { Button } from "./button";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";

type View = { kind: "list" } | { kind: "add" } | { kind: "check"; id: string } | { kind: "edit"; id: string } | { kind: "delete"; id: string };

const money = (p: ProductView) => `${p.currency ?? ""} ${Number(p.price).toLocaleString()}`.trim();

// Products grid and its add/check/edit/delete flows (DX-07, DX-09, DX-27).
export function ProductsView({ shopId, products }: { shopId: string; products: ProductView[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "list" });
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const current = "id" in view ? products.find((p) => p.id === view.id) : undefined;

  const run = (job: () => Promise<{ ok: boolean }>, after: View = { kind: "list" }) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => ({ ok: false }));
      if (!res.ok) return setFailed(true);
      router.refresh();
      setView(after);
    });

  const error = failed && (
    <p role="alert" className="text-sm text-danger">
      {t("common.error")}
    </p>
  );

  if (view.kind === "check" && current) {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("products.checkTitle")}</h1>
        <p className="text-muted">{t("products.checkBody")}</p>
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card border border-border bg-white">
          {current.cutout_url && <Image src={current.cutout_url} alt={current.name} fill sizes="384px" className="object-contain" />}
        </div>
        <p className="text-center font-medium">{current.name}</p>
        {error}
        <Button onClick={() => run(() => setCutoutConfirmed(current.id, true))} disabled={pending} aria-busy={pending}>
          {t("products.looksRight")}
        </Button>
        <Button variant="text" onClick={() => run(() => deleteProduct(current.id))} disabled={pending}>
          {t("products.retake")}
        </Button>
      </section>
    );
  }

  if (view.kind === "delete" && current) {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("products.deleteTitle")}</h1>
        <p className="text-muted">{t("products.deleteBody", { name: current.name })}</p>
        {error}
        <Button variant="danger" onClick={() => run(() => deleteProduct(current.id))} disabled={pending} aria-busy={pending}>
          {t("products.deleteConfirm")}
        </Button>
        <Button variant="text" onClick={() => setView({ kind: "list" })}>
          {t("products.cancel")}
        </Button>
      </section>
    );
  }

  if (view.kind === "add") {
    return <AddProduct shopId={shopId} onCancel={() => setView({ kind: "list" })} onDone={(id) => { router.refresh(); setView(id ? { kind: "check", id } : { kind: "list" }); }} />;
  }

  if (view.kind === "edit" && current) {
    return (
      <ProductForm
        key={current.id}
        product={current}
        pending={pending}
        failed={failed}
        onCancel={() => setView({ kind: "list" })}
        onSave={(draft) => run(() => saveProduct({ id: current.id, ...draft }))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">{t("products.title")}</h1>
          <p className="text-muted">{t("products.body", { n: products.length })}</p>
        </div>
        <Button className="w-auto! px-5" onClick={() => setView({ kind: "add" })}>
          {t("products.add")}
        </Button>
      </header>

      {products.length === 0 ? (
        <p className="rounded-card border border-border bg-white p-5 text-muted">{t("products.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {products.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-white p-3">
              <div className="relative aspect-square overflow-hidden rounded-control bg-surface">
                {p.cutout_url && <Image src={p.cutout_url} alt={p.name} fill sizes="(min-width: 1024px) 320px, 50vw" className="object-contain" />}
              </div>
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-sm text-muted">{p.category}</p>
                {p.price != null && <p className="text-sm font-medium">{money(p)}</p>}
                <p className={`flex items-center gap-1.5 text-xs font-medium ${p.cutout_confirmed ? "text-blue" : "text-danger"}`}>
                  <span aria-hidden="true">{p.cutout_confirmed ? "✓" : "!"}</span>
                  {t(p.cutout_confirmed ? "products.checked" : "products.needsCheck")}
                </p>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setView(p.cutout_confirmed ? { kind: "edit", id: p.id } : { kind: "check", id: p.id })}>
                  {t(p.cutout_confirmed ? "products.edit" : "products.needsCheck")}
                </Button>
                <Button variant="text" className="text-danger!" onClick={() => setView({ kind: "delete", id: p.id })}>
                  {t("products.delete")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AddProduct({ shopId, onDone, onCancel }: { shopId: string; onDone: (id: string | null) => void; onCancel: () => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<"type" | "failed" | null>(null);

  const submit = (file: File | undefined) => {
    if (!file) return;
    if (!validPhoto(file)) return setError("type");
    start(async () => {
      setError(null);
      const res = await uploadAndExtract(shopId, [file]).catch(() => null);
      if (!res || res.failures.length) return setError("failed");
      onDone(res.products[0]?.id ?? null);
    });
  };

  return (
    <section className="flex max-w-xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">{t("products.addTitle")}</h1>
      <p className="text-muted">{t("products.addBody")}</p>
      <input ref={pick} type="file" accept={ACCEPT} className="sr-only" aria-label={t("products.addPhoto")} onChange={(e) => submit(e.target.files?.[0])} />
      {pending && <p role="status" className="text-sm text-muted">{t("ob2.uploading")}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t(error === "type" ? "ob2.badFile" : "ob2.failed")}
        </p>
      )}
      <Button onClick={() => pick.current?.click()} disabled={pending} aria-busy={pending}>
        {t("products.addPhoto")}
      </Button>
      <Button variant="text" onClick={onCancel} disabled={pending}>
        {t("products.cancel")}
      </Button>
    </section>
  );
}

function ProductForm({
  product,
  pending,
  failed,
  onSave,
  onCancel,
}: {
  product: ProductView;
  pending: boolean;
  failed: boolean;
  onSave: (draft: { name: string; category: string; price: number | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? "Other");
  const [price, setPrice] = useState(product.price != null ? String(Number(product.price)) : "");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const n = price.trim() === "" ? null : Number(price);
    if (!name.trim() || (n !== null && !(n > 0))) return setInvalid(true);
    onSave({ name: name.trim(), category, price: n });
  };

  return (
    <section className="flex max-w-xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">{t("products.editTitle")}</h1>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card border border-border bg-white">
        {product.cutout_url && <Image src={product.cutout_url} alt={t("products.photo")} fill sizes="384px" className="object-contain" />}
      </div>
      <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
        <label className={label}>
          {t("products.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className={label}>
          {t("products.category")}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {[...new Set([category, ...CATEGORIES])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("products.price")}
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={input} />
        </label>
      </div>
      {(invalid || failed) && (
        <p role="alert" className="text-sm text-danger">
          {t(invalid ? "products.nameError" : "common.error")}
        </p>
      )}
      <Button onClick={submit} disabled={pending} aria-busy={pending}>
        {t("products.save")}
      </Button>
      <Button variant="text" onClick={onCancel}>
        {t("products.cancel")}
      </Button>
    </section>
  );
}
