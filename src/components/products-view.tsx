"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteProduct, saveProduct, setCutoutConfirmed } from "@/lib/actions/products";
import type { ProductView } from "@/lib/data/products";
import { t } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/options";
import { attributesText, parseAttributes, type Attributes } from "@/lib/product-fields";
import { ACCEPT, uploadAndExtract, validPhoto } from "@/lib/upload";
import { Button, ButtonLink } from "./button";
import { Field, glassInput } from "./field";
import { InfoCard } from "./info-card";
import { PageHeader } from "./page-header";
import { StatusScreen } from "./status-screen";
import { UploadError } from "./upload-error";

type View = { kind: "list"; made?: string } | { kind: "add"; replace?: string } | { kind: "check"; id: string } | { kind: "edit"; id: string } | { kind: "delete"; id: string };

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

const STEPS = ["products.stepUpload", "products.stepCutout", "products.stepDetails", "products.stepFinish"] as const;
// Rough timings for when each step usually starts; the last active step keeps spinning until the work finishes.
const STEP_AT_MS = [0, 3000, 9000, 16000];

// Photo being processed: a scan line sweeps the photo and a step list shows what is happening now.
// `from` may move forward while mounted (onboarding switches from uploading to preparing); `more` shows the other photos in the batch.
export function ProcessingPhoto({ src, from = 0, more = [] }: { src?: string; from?: number; more?: string[] }) {
  const [timed, setStep] = useState(from);
  const step = Math.max(timed, from);
  useEffect(() => {
    const timers = STEP_AT_MS.map((ms, i) => (i > from ? setTimeout(() => setStep(i), ms - STEP_AT_MS[from]) : undefined));
    return () => timers.forEach((id) => id && clearTimeout(id));
  }, [from]);

  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <figure className="mx-auto flex w-full max-w-90 flex-col gap-2 leading-[1.35] font-semibold">
        <div className="photo-processing relative aspect-[4/5] overflow-hidden rounded-card bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          {src && <img src={src} alt="" className="size-full object-contain" />}
          <div aria-hidden="true" className="photo-shimmer absolute inset-0" />
          <div aria-hidden="true" className="photo-scan-line" />
        </div>
        {more.length > 0 && (
          <ul aria-hidden="true" className="grid grid-cols-5 gap-2">
            {more.map((url, i) => (
              <li key={url} className="photo-processing relative aspect-square overflow-hidden rounded-control bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={url} alt="" className="size-full object-cover" style={{ animationDelay: `${i * 300}ms` }} />
                <div className="photo-shimmer absolute inset-0" style={{ animationDelay: `${i * 200}ms` }} />
              </li>
            ))}
          </ul>
        )}
        <figcaption className="flex flex-col gap-2">
          <span className="text-[10px] uppercase">{t("products.processingEyebrow")}</span>
          <span>{t("products.processingCaption")}</span>
        </figcaption>
      </figure>
      <ol className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4]">
        {STEPS.map((key, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={key} aria-current={state === "active" ? "step" : undefined} className={`flex items-center gap-3 text-[15px] transition-opacity duration-300 ${state === "todo" ? "text-muted opacity-60" : "font-semibold"}`}>
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
                {state === "done" && <span className="flex size-6 items-center justify-center rounded-full bg-blue text-xs text-white">✓</span>}
                {state === "active" && <span className="size-5 animate-spin rounded-full border-2 border-powder border-t-blue" />}
                {state === "todo" && <span className="size-2 rounded-full bg-powder" />}
              </span>
              {t(key)}
            </li>
          );
        })}
      </ol>
    </div>
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
  // Drop the deep-link query without a router navigation: router.replace refetches the page and can remount it, resetting the view to "add".
  useEffect(() => {
    if (query) window.history.replaceState(null, "", "/products");
  }, [query]);
  const current = "id" in view ? products.find((p) => p.id === view.id) : undefined;

  const run = (job: () => Promise<{ ok: boolean }>, after: View = { kind: "list" }) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => ({ ok: false }));
      if (!res.ok) return setFailed(true);
      setView(after);
      router.refresh();
    });

  const error = failed && (
    <p role="alert" className="text-sm text-danger">
      {t("common.error")}
    </p>
  );

  // The new product is created but the refreshed list has not arrived yet: wait here instead of falling back to the list or add screen.
  if (view.kind === "check" && !current) {
    return (
      <StatusScreen title={t("products.processingTitle")} body={t("products.processingBody")}>
        <ProcessingPhoto from={STEPS.length - 1} />
        {!pending && (
          <Button variant="text" onClick={() => setView({ kind: "list" })}>
            {t("products.cancel")}
          </Button>
        )}
      </StatusScreen>
    );
  }

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
        <Button onClick={() => run(() => setCutoutConfirmed(current.id, true), { kind: "list", made: current.id })} disabled={pending} aria-busy={pending}>
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
    return <AddProduct shopId={shopId} replace={view.replace} onCancel={() => setView({ kind: "list" })} onDone={(id) => { setView(id ? { kind: "check", id } : { kind: "list" }); start(() => router.refresh()); }} />;
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

  // Just confirmed: offer a post with this product as a dismissible banner, so the rest of the list stays in view (SRD A-11).
  const made = view.kind === "list" && view.made ? products.find((p) => p.id === view.made) : undefined;

  // Your products (228:13455 / 228:13510)
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("products.eyebrow")} title={t("products.title")} body={t("products.body")} eyebrowDesktop />
      {made && (
        <section role="status" className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4] lg:max-w-[544px]">
          <h2 className="text-lg font-semibold">{t("products.madeTitle")}</h2>
          <p className="text-[15px] text-muted">{t("products.madeBody", { name: made.name })}</p>
          {/* Opens the create flow (brief → brand kit → review); nothing generates until the owner presses Generate (FD-46). */}
          <ButtonLink href={`/create?product=${made.id}`}>{t("products.makePost")}</ButtonLink>
          <Button variant="text" onClick={() => setView({ kind: "list" })}>
            {t("products.notNow")}
          </Button>
        </section>
      )}
      {/* Library window, styled after the landing "01 / Products" card: toolbar, then a grid of numbered photo tiles. */}
      <section className="overflow-hidden rounded-card border border-border bg-white shadow-[0_24px_48px_rgb(33_61_140/0.10)]">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:px-6 lg:py-4">
          <span className="text-sm text-muted">
            {String(products.length).padStart(2, "0")} / {t("nav.products")}
          </span>
          <button
            type="button"
            data-tour="add-product"
            onClick={() => setView({ kind: "add" })}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-white px-4 text-sm font-semibold text-navy shadow-[0_8px_20px_rgb(33_61_140/0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgb(33_61_140/0.14)]"
          >
            <span aria-hidden="true" className="text-base">＋</span>
            {t("products.add")}
          </button>
        </header>

        {products.length === 0 ? (
          <div className="p-4 lg:p-6">
            <button
              type="button"
              onClick={() => setView({ kind: "add" })}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-powder text-muted transition hover:border-blue hover:text-blue sm:aspect-[3/1]"
            >
              <span aria-hidden="true" className="text-2xl">＋</span>
              <span className="text-sm">{t("products.empty")}</span>
            </button>
          </div>
        ) : (
          <ol className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-4 sm:p-4 lg:gap-5 lg:p-6">
            {products.map((p, i) => {
              const open = () => setView(p.cutout_confirmed ? { kind: "edit", id: p.id } : { kind: "check", id: p.id });
              return (
                <li key={p.id} className="group flex flex-col rounded-[16px] bg-white p-2 shadow-[0_10px_28px_rgb(33_61_140/0.12)] ring-1 ring-border transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgb(33_61_140/0.18)]">
                  <button type="button" onClick={open} aria-label={`${t(p.cutout_confirmed ? "products.edit" : "products.check")}: ${p.name}`} className="relative aspect-[4/5] overflow-hidden rounded-control bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
                    {p.cutout_url && <Image src={p.cutout_url} alt={p.name} fill sizes="(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw" className="object-contain p-2 transition duration-300 group-hover:scale-[1.03]" />}
                    {!p.cutout_confirmed && (
                      <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-navy">{t("products.check")}</span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col gap-1 px-1.5 pt-2.5 pb-1">
                    <div className="flex items-baseline gap-2">
                      <span aria-hidden="true" className="text-xs text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink" title={p.name}>{p.name}</h2>
                    </div>
                    <p className="truncate text-sm text-muted">
                      {[p.category, p.price != null ? money(p) : null].filter(Boolean).join(" · ") || t("products.priceNone")}
                    </p>
                    <div className="mt-auto flex flex-col gap-2 pt-3">
                      {p.cutout_confirmed ? (
                        <>
                          <Link href={`/create?product=${p.id}`} className="flex min-h-10 items-center justify-center rounded-full bg-blue px-3 text-sm font-semibold whitespace-nowrap text-white transition hover:bg-navy">
                            {t("products.makePost")}
                          </Link>
                          <button type="button" onClick={open} className="flex min-h-10 items-center justify-center rounded-full border border-border px-3 text-sm font-semibold whitespace-nowrap text-navy transition hover:bg-surface">
                            {t("products.edit")}
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={open} className="flex min-h-10 items-center justify-center rounded-full border border-border px-3 text-sm font-semibold whitespace-nowrap text-navy transition hover:bg-surface">
                          {t("products.check")}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setView({ kind: "add" })}
                className="flex size-full min-h-48 flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-powder text-sm font-semibold text-muted transition hover:border-blue hover:text-blue"
              >
                <span aria-hidden="true" className="text-2xl">＋</span>
                {t("products.add")}
              </button>
            </li>
          </ol>
        )}
      </section>
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
      <StatusScreen title={t("products.processingTitle")} body={t("products.processingBody")}>
        <ProcessingPhoto src={previews[0]} />
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
