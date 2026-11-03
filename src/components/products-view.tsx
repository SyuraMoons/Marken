"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteProduct, saveProduct, setCutoutConfirmed } from "@/lib/actions/products";
import type { ProductView } from "@/lib/data/products";
import { t } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/options";
import { attributesText, parseAttributes, type Attributes } from "@/lib/product-fields";
import { ACCEPT, uploadAndExtract, validPhoto } from "@/lib/upload";
import { Button } from "./button";
import { Field, glassInput } from "./field";
import { InfoCard } from "./info-card";
import { PageHeader } from "./page-header";
import { StatusScreen } from "./status-screen";
import { UploadError } from "./upload-error";

type View = { kind: "list" } | { kind: "add"; replace?: string } | { kind: "check"; id: string } | { kind: "edit"; id: string } | { kind: "delete"; id: string };

const money = (p: ProductView) => `${p.currency ?? ""} ${Number(p.price).toLocaleString()}`.trim();

// Product photo with the caption under it (Figma "Product image + separate caption"); cutouts sit on a soft stage.
export function Photo({ src, alt, eyebrow, caption, className = "" }: { src: string | null; alt: string; eyebrow: string; caption: string; className?: string }) {
  return (
    <figure className={`flex flex-col gap-2 leading-[1.35] font-semibold ${className}`}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
        {src && <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 160px, 90vw" className="object-contain" />}
      </div>
      <figcaption className="flex flex-col gap-2">
        <span className="text-[10px] uppercase lg:text-xs">{eyebrow}</span>
        <span className="lg:text-xs">{caption}</span>
      </figcaption>
    </figure>
  );
}

// Products (Figma page 02): list, add, cutout check, edit, delete (DX-07, DX-27).
export function ProductsView({ shopId, products }: { shopId: string; products: ProductView[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "list" });
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  // The product switcher deep-links here (?add=1 / ?edit=<id>), including while already on this page.
  const params = useSearchParams();
  const query = params.toString();
  const [seen, setSeen] = useState("");
  if (query !== seen) {
    setSeen(query);
    const edit = params.get("edit");
    if (params.get("add")) setView({ kind: "add" });
    else if (edit && products.some((p) => p.id === edit)) setView({ kind: "edit", id: edit });
  }
  useEffect(() => {
    if (query) router.replace("/products", { scroll: false });
  }, [query, router]);
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

  // Does this cutout look right? (228:13956)
  if (view.kind === "check" && current) {
    return (
      <StatusScreen title={t("products.checkTitle")} body={t("products.checkBody")}>
        <Photo src={current.cutout_url} alt={current.name} eyebrow={t("products.checkEyebrow")} caption={t("products.checkCaption")} className="mx-auto w-full max-w-90" />
        <InfoCard vector="check" title={t("products.visibleTitle")}>
          {t("products.visibleBody")}
        </InfoCard>
        <Field n={1} cue="product" label={t("products.extractedName")}>
          <input value={current.name} readOnly className={glassInput} />
        </Field>
        <Field n={2} cue="tag" label={t("products.priceOptional")}>
          <input value={current.price != null ? money(current) : t("products.notVisible")} readOnly className={glassInput} />
        </Field>
        {error}
        <Button onClick={() => run(() => setCutoutConfirmed(current.id, true))} disabled={pending} aria-busy={pending}>
          {t("products.confirm")}
        </Button>
        {/* The old product is removed only after the new photo uploads, so cancelling or a failed upload loses nothing. */}
        <Button variant="secondary" onClick={() => setView({ kind: "add", replace: current.id })} disabled={pending}>
          {t("products.replace")}
        </Button>
        <Button variant="text" onClick={() => setView({ kind: "edit", id: current.id })}>
          {t("products.editDetails")}
        </Button>
      </StatusScreen>
    );
  }

  // Delete this product? (228:14111)
  if (view.kind === "delete" && current) {
    return (
      <StatusScreen title={t("products.deleteTitle")} body={t("products.deleteBody")}>
        <section className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4]">
          <h2 className="text-lg font-semibold">{t("products.deleteCard", { name: current.name })}</h2>
          <p className="text-[15px] text-muted">{t("products.deleteCardBody")}</p>
        </section>
        {error}
        <Button variant="danger" onClick={() => run(() => deleteProduct(current.id))} disabled={pending} aria-busy={pending}>
          {t("products.deleteConfirm")}
        </Button>
        <Button variant="secondary" onClick={() => setView({ kind: "list" })}>
          {t("products.keep")}
        </Button>
      </StatusScreen>
    );
  }

  if (view.kind === "add") {
    return <AddProduct shopId={shopId} replace={view.replace} onCancel={() => setView({ kind: "list" })} onDone={(id) => { router.refresh(); setView(id ? { kind: "check", id } : { kind: "list" }); }} />;
  }

  if (view.kind === "edit" && current) {
    return (
      <ProductForm
        key={current.id}
        product={current}
        pending={pending}
        failed={failed}
        onCancel={() => setView({ kind: "list" })}
        onReview={() => setView({ kind: "check", id: current.id })}
        onDelete={() => setView({ kind: "delete", id: current.id })}
        onSave={(draft) => run(() => saveProduct({ id: current.id, ...draft }))}
      />
    );
  }

  // Your products (228:13455 / 228:13510)
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("products.eyebrow")} title={t("products.title")} body={t("products.body")} eyebrowDesktop />
      <Button data-tour="add-product" className="max-lg:hidden lg:w-50!" onClick={() => setView({ kind: "add" })}>
        {t("products.add")}
      </Button>

      {products.length === 0 && <p className="glass rounded-card p-5 text-muted">{t("products.empty")}</p>}
      <ol className="flex flex-col gap-6 lg:gap-7">
        {products.map((p, i) => (
          <li key={p.id} className="flex flex-col gap-6 lg:glass lg:flex-row lg:items-start lg:gap-7 lg:rounded-2xl lg:p-6">
            <Photo
              src={p.cutout_url}
              alt={p.name}
              eyebrow={p.category ?? t("products.eyebrow")}
              caption={t(p.cutout_confirmed ? "products.confirmedCutout" : "products.uncheckedCutout")}
              className="lg:w-40 lg:shrink-0"
            />
            <section className="glass flex flex-1 flex-col gap-3 rounded-card p-5 leading-[1.4] lg:py-6 lg:pl-[22px]">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="text-[15px] text-muted">
                {t(p.cutout_confirmed ? "products.lineChecked" : "products.lineUnchecked", { category: p.category ?? "" })}
                <br />
                {p.price != null ? money(p) : t("products.priceNone")}
              </p>
              <Button variant="secondary" onClick={() => setView(p.cutout_confirmed ? { kind: "edit", id: p.id } : { kind: "check", id: p.id })}>
                {t(p.cutout_confirmed ? "products.edit" : "products.check")}
              </Button>
            </section>
            <span aria-hidden="true" className="hidden w-10 text-sm text-muted lg:block">{String(i + 1).padStart(2, "0")}</span>
          </li>
        ))}
      </ol>
      <Button data-tour="add-product" className="lg:hidden" onClick={() => setView({ kind: "add" })}>
        {t("products.add")}
      </Button>

      <div className="lg:max-w-[544px]">
        <InfoCard vector="photo" title={t("products.howTitle")}>
          {t("products.howBody")}
        </InfoCard>
      </div>
    </div>
  );
}

const MAX_PHOTOS = 3;

const TIPS = [
  ["whole", "products.tipWhole"],
  ["light", "products.tipLight"],
  ["backdrop", "products.tipBackdrop"],
] as const;

// Add one product (228:13807): up to 3 photos per Figma; only photo 1 is uploaded until the backend groups photos (FD-33).
function AddProduct({ shopId, replace, onDone, onCancel }: { shopId: string; replace?: string; onDone: (id: string | null) => void; onCancel: () => void }) {
  const pick = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<"type" | "failed" | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  // Free the local previews when the photos change or the screen closes.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const choose = (list: FileList | null) => {
    if (!list) return;
    const good = Array.from(list).filter(validPhoto);
    setError(good.length < list.length ? "type" : null);
    setFiles((cur) => [...cur, ...good].slice(0, MAX_PHOTOS));
    if (pick.current) pick.current.value = "";
  };

  // shortcut: sends photo 1 only, because each upload becomes its own product; send all once A-08 lands.
  const submit = () =>
    files[0] &&
    start(async () => {
      setError(null);
      const res = await uploadAndExtract(shopId, [files[0]]).catch(() => null);
      if (!res || res.failures.length) return setError("failed");
      const id = res.products[0]?.id ?? null;
      // Best effort: if the old one cannot be removed it stays in the list, and retrying here would only upload a duplicate.
      if (id && replace) await deleteProduct(replace).catch(() => null);
      onDone(id);
    });

  if (pending) {
    return (
      <StatusScreen title={t("products.uploadingTitle")} body={t("products.uploadingBody")}>
        <div aria-busy="true" aria-live="polite">
          <InfoCard vector="photo" title={t("products.uploadingCard")}>
            {t("products.uploadingCardBody")}
          </InfoCard>
        </div>
        <InfoCard vector="check" title={t("loading.waitTitle")}>
          {t("loading.waitBody")}
        </InfoCard>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen title={t("products.addTitle")} body={t("products.addBody")}>
      <figure className="mx-auto flex w-full max-w-90 flex-col gap-2 leading-[1.35] font-semibold">
        <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          {previews[0] && <img src={previews[0]} alt={t("ob2.photo", { n: 1 })} className="size-full object-contain" />}
        </div>
        <figcaption className="flex flex-col gap-2">
          <span className="text-[10px] uppercase">{t("products.guideEyebrow")}</span>
          <span>{t("products.guideTitle")}</span>
        </figcaption>
      </figure>
      <section className="glass flex flex-col gap-2 rounded-card p-5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("products.tipsTitle")}</h2>
        <ul className="grid grid-cols-3 gap-2">
          {TIPS.map(([icon, key]) => (
            <li key={icon} className="flex flex-col gap-2 text-xs font-medium">
              {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
              <img src={`/figma/tip-${icon}.svg`} width={48} height={48} alt="" />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>
      <section className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4]">
        <h2 className="text-lg font-semibold">{t("products.uploadTitle")}</h2>
        <p className="text-[15px] text-muted">{files.length ? t("products.chosen", { n: files.length, total: MAX_PHOTOS }) : t("products.uploadBody")}</p>
        {files.length > 0 && (
          <ul className="grid grid-cols-3 gap-3">
            {previews.map((src, i) => (
              <li key={src} className="relative aspect-square overflow-hidden rounded-control bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={src} alt={t("ob2.photo", { n: i + 1 })} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  aria-label={t("ob2.remove", { n: i + 1 })}
                  className="absolute top-0 right-0 flex size-11 items-center justify-center text-lg text-ink"
                >
                  <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white/90">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length > 1 && <p className="text-sm text-muted">{t("products.firstOnly")}</p>}
        <input ref={pick} type="file" accept={ACCEPT} multiple className="sr-only" aria-label={t("products.choose")} onChange={(e) => choose(e.target.files)} />
        {error === "type" && (
          <p role="alert" className="text-sm text-danger">
            {t("ob2.badFile")}
          </p>
        )}
        {error === "failed" ? (
          <UploadError onRetry={submit} onChoose={() => { setError(null); pick.current?.click(); }} />
        ) : (
          <>
            <Button variant="secondary" onClick={() => pick.current?.click()} disabled={files.length >= MAX_PHOTOS}>
              {t("products.choose")}
            </Button>
            <Button onClick={submit} disabled={!files.length}>
              {t("products.review")}
            </Button>
          </>
        )}
        <Button variant="text" onClick={onCancel}>
          {t("products.cancel")}
        </Button>
      </section>
    </StatusScreen>
  );
}

// Edit product details (228:13590): numbered glass fields, then the source photo.
export function ProductForm({
  title = t("products.editTitle"),
  body = t("products.editBody"),
  product,
  pending,
  failed,
  onSave,
  onCancel,
  onReview,
  onDelete,
}: {
  title?: string;
  body?: string;
  product: ProductView;
  pending: boolean;
  failed: boolean;
  onSave: (draft: { name: string; category: string; price: number | null; currency: string | null; attributes: Attributes; description: string | null }) => void;
  onCancel: () => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState(product.category ?? "Other");
  const [price, setPrice] = useState(product.price != null ? String(Number(product.price)) : "");
  const [currency, setCurrency] = useState(product.currency ?? "");
  const [attributes, setAttributes] = useState(attributesText(product.attributes));
  const [description, setDescription] = useState(product.description ?? "");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    const n = price.trim() === "" ? null : Number(price);
    if (!name.trim() || (n !== null && !(n > 0))) return setInvalid(true);
    onSave({ name: name.trim(), category, price: n, currency: currency.trim() || null, attributes: parseAttributes(attributes), description: description.trim() || null });
  };

  return (
    <StatusScreen title={title} body={body}>
      <Field n={1} cue="product" label={t("products.name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} className={glassInput} />
      </Field>
      <Field n={2} cue="tag" label={t("products.category")}>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={glassInput}>
          {[...new Set([category, ...CATEGORIES])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field n={3} cue="tag" label={t("products.price")}>
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={t("products.priceNone")} className={glassInput} />
      </Field>
      <Field n={4} cue="globe" label={t("products.currency")}>
        <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 10))} className={glassInput} />
      </Field>
      <Field n={5} cue="product" label={t("products.attributes")}>
        <input value={attributes} onChange={(e) => setAttributes(e.target.value)} placeholder={t("products.attributesPlaceholder")} className={glassInput} />
      </Field>
      <Field n={6} cue="text" label={t("products.description")}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={glassInput} />
      </Field>
      <Photo src={product.cutout_url} alt={product.name} eyebrow={product.name} caption={t("products.sourcePhoto")} className="mx-auto w-full max-w-90" />
      {(invalid || failed) && (
        <p role="alert" className="text-sm text-danger">
          {t(invalid ? "products.nameError" : "common.error")}
        </p>
      )}
      <Button onClick={submit} disabled={pending} aria-busy={pending}>
        {t("products.save")}
      </Button>
      <Button variant="secondary" onClick={onReview}>
        {t("products.replaceReview")}
      </Button>
      <Button variant="text" className="text-danger!" onClick={onDelete}>
        {t("products.delete")}
      </Button>
      <Button variant="text" onClick={onCancel}>
        {t("products.cancel")}
      </Button>
    </StatusScreen>
  );
}
