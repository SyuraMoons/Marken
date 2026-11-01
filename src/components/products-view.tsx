"use client";

import Image from "next/image";
import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { t } from "@/lib/i18n";
import { mockProductPhoto, mockProducts } from "@/lib/mock";
import { Button } from "./button";
import { UploadError } from "./upload-error";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";

type View = { kind: "list" } | { kind: "add" } | { kind: "check"; id: string } | { kind: "edit"; id: string } | { kind: "delete"; id: string };

// Products grid and its add/check/edit/delete flows (DX-07, DX-09, DX-27). Mocks until product writes land.
export function ProductsView() {
  const [items, setItems] = useState(mockProducts);
  const [view, setView] = useState<View>({ kind: "list" });
  const current = "id" in view ? items.find((p) => p.id === view.id) : undefined;

  const save = (id: string, patch: Partial<Tables<"products">>) => {
    setItems(items.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setView({ kind: "list" });
  };

  if (view.kind === "check" && current) {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("products.checkTitle")}</h1>
        <p className="text-muted">{t("products.checkBody")}</p>
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card border border-border bg-white">
          {current.cutout_path && <Image src={current.cutout_path} alt={current.name} fill sizes="384px" className="object-cover" />}
        </div>
        <p className="text-center font-medium">{current.name}</p>
        <Button onClick={() => save(current.id, { cutout_confirmed: true })}>{t("products.looksRight")}</Button>
        <Button variant="text" onClick={() => setView({ kind: "edit", id: current.id })}>
          {t("products.retake")}
        </Button>
      </section>
    );
  }

  if ((view.kind === "edit" || view.kind === "add") || (view.kind === "delete" && current)) {
    if (view.kind === "delete" && current) {
      return (
        <section className="flex max-w-xl flex-col gap-5">
          <h1 className="text-3xl font-semibold tracking-tight">{t("products.deleteTitle")}</h1>
          <p className="text-muted">{t("products.deleteBody", { name: current.name })}</p>
          <Button
            variant="danger"
            onClick={() => {
              setItems(items.filter((p) => p.id !== current.id));
              setView({ kind: "list" });
            }}
          >
            {t("products.deleteConfirm")}
          </Button>
          <Button variant="text" onClick={() => setView({ kind: "list" })}>
            {t("products.cancel")}
          </Button>
        </section>
      );
    }
    return (
      <ProductForm
        key={view.kind === "edit" && current ? current.id : "new"}
        product={view.kind === "edit" ? current : undefined}
        onCancel={() => setView({ kind: "list" })}
        onSave={(draft) => {
          if (view.kind === "edit" && current) return save(current.id, draft);
          const id = `new-${items.length + 1}`;
          setItems([...items, { ...mockProducts[0], id, ...draft, cutout_path: mockProductPhoto.src, cutout_confirmed: false }]);
          setView({ kind: "check", id });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">{t("products.title")}</h1>
          <p className="text-muted">{t("products.body", { n: items.length })}</p>
        </div>
        <Button className="w-auto! px-5" onClick={() => setView({ kind: "add" })}>
          {t("products.add")}
        </Button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-card border border-border bg-white p-5 text-muted">{t("products.empty")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {items.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-white p-3">
              <div className="relative aspect-square overflow-hidden rounded-control bg-surface">
                {p.cutout_path && <Image src={p.cutout_path} alt={p.name} fill sizes="(min-width: 1024px) 320px, 50vw" className="object-cover" />}
              </div>
              <div className="flex flex-col gap-0.5 px-1">
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-sm text-muted">{p.category}</p>
                {p.price != null && <p className="text-sm font-medium">{p.currency ?? "IDR"} {p.price.toLocaleString("id-ID")}</p>}
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

function ProductForm({
  product,
  onSave,
  onCancel,
}: {
  product?: Tables<"products">;
  onSave: (draft: Pick<Tables<"products">, "name" | "category" | "price" | "currency" | "attributes" | "description">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "Beauty");
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : "");
  const [currency, setCurrency] = useState(product?.currency ?? "IDR");
  const [attributes, setAttributes] = useState(
    Array.isArray(product?.attributes)
      ? product.attributes.map(String).join(", ")
      : product?.attributes && typeof product.attributes === "object"
        ? Object.entries(product.attributes).map(([k, v]) => `${k}: ${String(v)}`).join(", ")
        : "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [error, setError] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  const submit = () => {
    if (!name.trim()) return setError(true);
    const parts = attributes.split(",").map((a) => a.trim()).filter(Boolean);
    // Keep key: value attributes as an object, plain tags as a list.
    const parsed = parts.length && parts.every((p) => p.includes(":")) ? Object.fromEntries(parts.map((p) => { const [k, ...rest] = p.split(":"); return [k.trim(), rest.join(":").trim()]; })) : parts;
    onSave({ name: name.trim(), category, price: price.trim() === "" ? null : Number(price), currency, attributes: parsed, description: description.trim() || null });
  };

  return (
    <section className="flex max-w-xl flex-col gap-5">
      <h1 className="text-3xl font-semibold tracking-tight">{t(product ? "products.editTitle" : "products.addTitle")}</h1>
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card border border-border bg-white">
        <Image src={product?.cutout_path ?? mockProductPhoto.src} alt={t("products.photo")} fill sizes="384px" className="object-cover" />
      </div>
      {/* shortcut: photo pick fails until /api/uploads lands, delete with the mock. */}
      <Button variant="secondary" onClick={() => setPhotoError(true)}>{t(product ? "products.changePhoto" : "products.addPhoto")}</Button>
      {photoError && <UploadError onRetry={() => setPhotoError(false)} onChoose={() => setPhotoError(false)} />}
      <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
        <label className={label}>
          {t("products.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className={label}>
          {t("products.category")}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            {["Food & drinks", "Fashion", "Beauty", "Crafts", "Home", "Other"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("products.price")}
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="189000" className={input} />
        </label>
        <label className={label}>
          {t("products.currency")}
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={input}>
            {["IDR", "USD", "SGD", "MYR", "THB", "PHP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("products.attributes")}
          <input value={attributes} onChange={(e) => setAttributes(e.target.value)} placeholder={t("products.attributesPlaceholder")} className={input} />
        </label>
        <label className={label}>
          {t("products.description")}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className="rounded-control border border-border bg-white p-3 font-normal placeholder:text-muted focus:outline-2 focus:outline-blue" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t("products.nameError")}
        </p>
      )}
      <Button onClick={submit}>{t("products.save")}</Button>
      <Button variant="text" onClick={onCancel}>
        {t("products.cancel")}
      </Button>
    </section>
  );
}
