"use client";

import { BrandKitEditor } from "./brand-kit-editor";
import { saveBrandKit } from "@/lib/actions/brand-kit";
import type { BrandKitValue } from "@/lib/brand-kit";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { AnchorButton, Button } from "./button";
import { Field, glassInput } from "./field";
import { InfoCard } from "./info-card";
import { Photo, ProcessingPhoto, ProductForm } from "./products-view";
import { Stage, Stages } from "./stages";
import { UploadError } from "./upload-error";
import { deleteProduct, removeUpload, saveProduct, setCutoutConfirmed } from "@/lib/actions/products";
import type { ProductView } from "@/lib/data/products";
import { t, type MessageKey } from "@/lib/i18n";
import { CATEGORIES, COUNTRIES, LOOK_PHRASE, LOOKS, lookOf, NEVER_KEYS, NEVER_PRESETS, TIME_ZONES, TONES, type Look, type NeverKey, type Tone } from "@/lib/options";
import { ACCEPT, patchOnboarding, uploadAndExtract, validPhoto } from "@/lib/upload";

export type SetupShop = {
  id: string;
  name: string;
  description?: string | null;
  category: string | null;
  country: string | null;
  content_language: "en" | "id";
  time_zone: string | null;
  tone: string | null;
  igConnected: boolean;
  completed: boolean;
};

// The owner's real product for steps 4 and 5: signed URLs only (NFR-13).
// `stalled`: the first post is generating but the job queue never started it (lib/posts/stalled).
export type SetupPreview = { name: string; cutout: string | null; photo: string | null; slide: string | null; postStatus: string | null; stalled: boolean };

// A photo uploaded earlier that has no product yet (signed URL only).
export type PendingUpload = { id: string; url: string | null; createdAt: string };

type Ctx = { shop: SetupShop; go: (step: number) => void; save: (body: Record<string, unknown>) => Promise<boolean> };

// All 5 onboarding steps (F-03, FR-OB, Figma page 05). Each step saves server-side before moving on (FR-OB-11).
export function SetupSteps({ step, shop, products, rules, brandKit, preview, pending }: { step: number; shop: SetupShop; products: ProductView[]; rules: string[]; brandKit: BrandKitValue; preview: SetupPreview | null; pending: PendingUpload[] }) {
  const router = useRouter();
  const ctx: Ctx = {
    shop,
    go: (n) => router.push(n > 5 ? "/posts" : `/onboarding/${n}`),
    save: (body) => patchOnboarding(shop.id, { step, ...body }),
  };

  // Logs the step start (FR-OB-12); a repeat visit is ignored by the route.
  useEffect(() => {
    void patchOnboarding(shop.id, { step, action: "start" });
  }, [shop.id, step]);

  return (
    <>
      {step === 1 && <Step1 ctx={ctx} />}
      {step === 2 && <Step2 ctx={ctx} products={products} pending={pending} />}
      {/* Keyed by ids so a replaced photo (router.refresh) resets the list. */}
      {step === 3 && <Step3 key={products.map((p) => p.id).join()} ctx={ctx} initial={products} />}
      {step === 4 && <Step4 ctx={ctx} initialRules={rules} initialKit={brandKit} preview={preview} />}
      {step === 5 && <Step5 ctx={ctx} preview={preview} />}
    </>
  );
}

function Head({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1 className="text-[30px] font-semibold lg:text-[32px] lg:leading-[1.2]">{title}</h1>
      <p className="text-muted">{body}</p>
    </>
  );
}

// Mobile: one stack. Desktop: two glass cards side by side (setup-* desktop frames).
function Split({ left, right }: { left: ReactNode; right: ReactNode }) {
  const card = "flex flex-col gap-4 lg:glass lg:rounded-2xl lg:p-6";
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
      <div className={card}>{left}</div>
      <div className={card}>{right}</div>
    </div>
  );
}

const Err = ({ show, text = "common.error" }: { show: boolean; text?: MessageKey }) =>
  show ? (
    <p role="alert" className="text-sm text-danger">
      {t(text)}
    </p>
  ) : null;

// Static illustrative photo with its caption (Figma "Product image + separate caption").
function Guide({ eyebrow, caption }: { eyebrow: string; caption: string }) {
  return (
    <figure className="flex w-full flex-col gap-2 leading-[1.35] font-semibold lg:max-w-75">
      <div className="relative aspect-[4/5] overflow-hidden rounded-card">
        <Image src="/figma/photo-guide.png" alt="" fill sizes="(min-width: 1024px) 300px, 90vw" className="object-cover" />
      </div>
      <figcaption className="flex flex-col gap-2">
        <span className="text-[10px]">{eyebrow}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

// Company description (228:16475 / 228:16555)
function Step1({ ctx }: { ctx: Ctx }) {
  const { shop } = ctx;
  const [name, setName] = useState(shop.name);
  const [description, setDescription] = useState(shop.description ?? "");
  const [category, setCategory] = useState(shop.category ?? CATEGORIES[0]);
  const [country, setCountry] = useState(shop.country ?? COUNTRIES[0]);
  const [language, setLanguage] = useState<"en" | "id">(shop.content_language);
  const [zone, setZone] = useState(shop.time_zone ?? "");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const submit = () =>
    start(async () => {
      setFailed(false);
      const ok = await ctx.save({ action: "finish", data: { name, description, category, country, content_language: language, time_zone: zone || Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!ok) return setFailed(true);
      ctx.go(2);
    });

  return (
    <form
      className="flex flex-col gap-5 lg:gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Head title={t("ob1.title")} body={t("ob1.body")} />
      <Split
        left={
          <>
            <Field n={1} cue="shop" label={t("ob1.name")}>
              <input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ob1.namePlaceholder")} autoComplete="organization" className={glassInput} />
            </Field>
            <Field n={2} cue="text" label={t("ob1.description")}>
              <textarea name="description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("ob1.descriptionPlaceholder")} className={glassInput} />
            </Field>
            <Field n={3} cue="tag" label={t("ob1.category")}>
              <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={glassInput}>
                {[...new Set([category, ...CATEGORIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field n={4} cue="globe" label={t("ob1.country")}>
              <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={glassInput}>
                {[...new Set([country, ...COUNTRIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </>
        }
        right={
          <>
            <Field n={5} cue="voice" label={t("ob1.language")}>
              <select name="language" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "id")} className={glassInput}>
                <option value="id">{t("settings.langId")}</option>
                <option value="en">{t("settings.langEn")}</option>
              </select>
            </Field>
            <Field n={6} cue="clock" label={t("ob1.timezone")}>
              <select name="time_zone" value={zone} onChange={(e) => setZone(e.target.value)} className={glassInput}>
                <option value="">{t("ob1.tzAuto")}</option>
                {[...new Set([zone, ...TIME_ZONES])].filter(Boolean).map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Err show={failed} />
            <Button type="submit" disabled={pending || !name.trim()} aria-busy={pending}>
              {t("ob1.continue")}
            </Button>
          </>
        }
      />
    </form>
  );
}

type Picked = { id: number; file: File; url: string };
type Phase = "idle" | "uploading" | "preparing";

const TIPS = [
  ["whole", "ob2.tipWhole"],
  ["light", "ob2.tipLight"],
  ["backdrop", "ob2.tipBackdrop"],
] as const;

// Keep upload and extraction loading tied to their real phases.
function Loading({ phase, urls }: { phase: "uploading" | "preparing"; urls: string[] }) {
  return <div className="flex max-w-xl flex-col gap-5"><Head title={t(`ob2.${phase}Title`)} body={t(`ob2.${phase}Body`)} /><ProcessingPhoto src={urls[0]} more={urls.slice(1)} from={phase === "preparing" ? 1 : 0} /><InfoCard vector="check" title={t("ob2.waitTitle")}>{t("ob2.waitBody")}</InfoCard></div>;
}

// The owner's product on the soft stage; `working` adds the scan-line while the real slide is still being made.
function RealPhoto({ src, alt, eyebrow, caption, working = false }: { src: string | null; alt: string; eyebrow: string; caption: string; working?: boolean }) {
  return (
    <figure className="flex w-full flex-col gap-2 leading-[1.35] font-semibold lg:max-w-75">
      <div className={`relative aspect-[4/5] overflow-hidden rounded-card bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)] ${working ? "photo-processing" : ""}`}>
        {src && <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 300px, 90vw" className="object-contain" />}
        {working && (
          <>
            <div aria-hidden="true" className="photo-shimmer absolute inset-0" />
            <div aria-hidden="true" className="photo-scan-line" />
          </>
        )}
      </div>
      <figcaption className="flex flex-col gap-2">
        <span className="text-[10px] uppercase">{eyebrow}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

const RESUME_MS = 3 * 60 * 1000;

// Add products (228:16642 / 228:16711). Onboarding needs at least 1 photo, up to 10 (route need_a_photo, SRD A-10).
// Everything already saved comes back here: prepared products, and photos whose preparation is still running or died.
function Step2({ ctx, products, pending }: { ctx: Ctx; products: ProductView[]; pending: PendingUpload[] }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const next = useRef(1);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [gaveUp, setGaveUp] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // A recent upload without a product is most likely still being prepared by the request from before the refresh.
  const running = gaveUp ? [] : pending.filter((u) => now - Date.parse(u.createdAt) < RESUME_MS);
  const stuck = pending.filter((u) => !running.includes(u));
  const resuming = phase === "idle" && running.length > 0 && photos.length === 0;
  const saved = products.length + pending.length;
  const total = saved + photos.length;
  const busy = phase !== "idle";
  const canContinue = photos.length > 0 || saved > 0;

  // Free the preview blobs on leave.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  // Re-read the page until the running photos turn into products (capped, so a dead run never polls forever).
  useEffect(() => {
    if (!resuming) return;
    let left = 45;
    const id = setInterval(() => {
      if (--left <= 0) {
        clearInterval(id);
        setGaveUp(true);
      } else router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [resuming, router]);

  const add = (files: FileList | null) => {
    if (!files) return;
    const good = Array.from(files).filter(validPhoto);
    setError(good.length < files.length ? "ob2.badFile" : null);
    const added = good.slice(0, 10 - total).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: next.current++, file, url };
    });
    setPhotos([...photos, ...added]);
    if (pick.current) pick.current.value = "";
  };

  const drop = async (id: string, job: () => Promise<{ ok: boolean }>) => {
    setBusyId(id);
    const res = await job().catch(() => null);
    setBusyId(null);
    if (!res?.ok) return setError("common.error");
    setError(null);
    router.refresh();
  };

  const submit = async () => {
    setError(null);
    // Only new photos are uploaded, and only photos without a product are prepared: the rest is already done.
    if (photos.length > 0 || stuck.length > 0) {
      setPhase("uploading");
      const res = await uploadAndExtract(ctx.shop.id, photos.map((p) => p.file), () => setPhase("preparing"), stuck.map((u) => u.id)).catch(() => null);
      if (!res || res.products.length === 0) return (setPhase("idle"), setError("ob2.failed"));
    }
    if (!(await ctx.save({ action: "finish" }))) return (setPhase("idle"), setError("common.error"));
    ctx.go(3);
  };

  if (busy) return <Loading phase={phase} urls={photos.length ? photos.map((p) => p.url) : stuck.map((u) => u.url ?? "").filter(Boolean)} />;
  if (resuming) return <Loading phase="preparing" urls={running.map((u) => u.url ?? "").filter(Boolean)} />;

  const tile = "relative aspect-square overflow-hidden rounded-control bg-white";
  const tag = "absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink";
  const remove = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="absolute top-0 right-0 flex size-11 items-center justify-center text-lg text-ink disabled:opacity-50">
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white/90">
        ×
      </span>
    </button>
  );

  return (
    <>
      <Head title={t("ob2.title")} body={t("ob2.body")} />
      <Split
        left={
          <>
            <Guide eyebrow={t("ob2.guideEyebrow")} caption={t("ob2.guide")} />
            <section className="glass flex flex-col gap-2 rounded-card p-5">
              <h2 className="text-lg font-semibold">{t("ob2.tips")}</h2>
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
          </>
        }
        right={
          <section className="glass flex flex-col gap-3 rounded-card p-5">
            <h2 className="text-lg font-semibold">{t("ob2.cardTitle")}</h2>
            <p className="text-[15px] text-muted">{total ? t("ob2.count", { n: total }) : t("ob2.cardBody")}</p>
            {saved > 0 && photos.length === 0 && <p className="text-sm">{t("ob2.have")}</p>}
            {total > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {products.map((p, i) => (
                  <li key={p.id} className={tile}>
                    {p.cutout_url && <Image src={p.cutout_url} alt={p.name} fill sizes="120px" className="object-contain" />}
                    <span className={tag}>{t("ob2.ready")}</span>
                    {remove(t("ob2.removeSaved", { n: i + 1 }), () => void drop(p.id, () => deleteProduct(p.id)), busyId === p.id)}
                  </li>
                ))}
                {pending.map((u, i) => (
                  <li key={u.id} className={tile}>
                    {u.url && <Image src={u.url} alt="" fill sizes="120px" className="object-cover" />}
                    <span className={tag}>{t("ob2.preparing")}</span>
                    {remove(t("ob2.removeSaved", { n: products.length + i + 1 }), () => void drop(u.id, () => removeUpload(u.id)), busyId === u.id)}
                  </li>
                ))}
                {photos.map((p, i) => (
                  <li key={p.id} className={tile}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img src={p.url} alt={t("ob2.photo", { n: i + 1 })} className="size-full object-cover" />
                    {remove(t("ob2.remove", { n: i + 1 }), () => setPhotos(photos.filter((x) => x.id !== p.id)))}
                  </li>
                ))}
              </ul>
            )}
            <input ref={pick} type="file" accept={ACCEPT} multiple className="sr-only" aria-label={t("ob2.choose")} onChange={(e) => add(e.target.files)} />
            {error === "ob2.failed" ? (
              <UploadError onRetry={submit} onChoose={() => (setError(null), pick.current?.click())} />
            ) : (
              <>
                <Err show={Boolean(error)} text={error ?? undefined} />
                {total < 10 && (
                  <Button variant="secondary" onClick={() => pick.current?.click()}>
                    {t(total ? "ob2.add" : "ob2.choose")}
                  </Button>
                )}
                {!canContinue && <p className="text-sm text-muted">{t("ob2.need")}</p>}
                <Button onClick={submit} disabled={!canContinue}>
                  {t(stuck.length > 0 && photos.length === 0 ? "ob2.retry" : "ob2.continue")}
                </Button>
              </>
            )}
          </section>
        }
      />
    </>
  );
}

// Review this product, one photo at a time (228:16787, 228:17683, 228:17796), plus details (228:17913).
function Step3({ ctx, initial }: { ctx: Ctx; initial: ProductView[] }) {
  const router = useRouter();
  const pick = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initial);
  const [index, setIndex] = useState(() => Math.max(0, initial.findIndex((p) => !p.cutout_confirmed)));
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const current = items[Math.min(index, items.length - 1)];

  const act = (job: () => Promise<{ ok: boolean } | null>, after: () => void) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => null);
      if (!res?.ok) return setFailed(true);
      after();
    });

  // One confirm per product; the last one saves the step and moves straight to step 4.
  const confirm = () =>
    start(async () => {
      setFailed(false);
      const res = await setCutoutConfirmed(current.id, true).catch(() => null);
      if (!res?.ok) return setFailed(true);
      const next = items.map((x) => (x.id === current.id ? { ...x, cutout_confirmed: true } : x));
      setItems(next);
      const todo = next.findIndex((x) => !x.cutout_confirmed);
      if (todo >= 0) return setIndex(todo);
      if (!(await ctx.save({ action: "finish" }))) return setFailed(true);
      ctx.go(4);
    });

  // Replace = upload the new photo as a product, then drop the old one.
  const replace = (file: File | undefined) => {
    if (!file || !validPhoto(file)) return setFailed(Boolean(file));
    act(
      async () => {
        const res = await uploadAndExtract(ctx.shop.id, [file]);
        return res.products.length ? deleteProduct(current.id) : { ok: false };
      },
      () => router.refresh(),
    );
  };

  if (editing && current) {
    return (
      <ProductForm
        title={t("ob3.detailsTitle")}
        body={t("ob3.detailsBody")}
        product={current}
        pending={pending}
        failed={failed}
        onSave={(draft) => act(() => saveProduct({ id: current.id, ...draft }), () => (setItems(items.map((x) => (x.id === current.id ? { ...x, ...draft } : x))), setEditing(false)))}
        onReview={() => setEditing(false)}
        onDelete={() => act(() => deleteProduct(current.id), () => (setItems(items.filter((x) => x.id !== current.id)), setIndex(0), setEditing(false)))}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!current) {
    return (
      <>
        <Head title={t("ob3.title")} body={t("ob3.need")} />
        <Button variant="secondary" className="lg:max-w-136" onClick={() => ctx.go(2)}>
          {t("setup.back")}
        </Button>
      </>
    );
  }

  return (
    <>
      <Head title={t("ob3.title")} body={t("ob3.body")} />
      <Split
        left={<Photo src={current.cutout_url} alt={current.name} eyebrow={t("ob3.photoOf", { n: index + 1, total: items.length })} caption={t("ob3.edges")} className="w-full lg:max-w-75" />}
        right={
          <>
            <InfoCard vector="check" title={t("ob3.visibleTitle")}>
              {t("ob3.visibleBody")}
            </InfoCard>
            <input ref={pick} type="file" accept={ACCEPT} className="sr-only" aria-label={t("ob3.replace")} onChange={(e) => replace(e.target.files?.[0])} />
            <Err show={failed} />
            <Button onClick={confirm} disabled={pending} aria-busy={pending}>
              {t("ob3.confirm")}
            </Button>
            <Button variant="secondary" onClick={() => pick.current?.click()} disabled={pending}>
              {t("ob3.replace")}
            </Button>
            <Button variant="text" onClick={() => setEditing(true)} disabled={pending}>
              {t("ob3.edit")}
            </Button>
          </>
        }
      />
    </>
  );
}

// Voice, look and Instagram as one question card at a time (Lovart-style). Each answer is saved when confirmed,
// so leaving for Instagram or skipping a question never loses anything.
const CARDS = ["tone", "never", "look", "ig", "summary"] as const;
type CardId = (typeof CARDS)[number];
const MAX_RULES = 10;

const toneOf = (v: string | null): Tone | null => TONES.find((x) => x === v) ?? null;

function Chip({ on, onClick, children, hint }: { on: boolean; onClick: () => void; children: ReactNode; hint?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`glass flex min-h-11 flex-col items-start gap-0.5 rounded-card px-4 py-3 text-left text-base font-medium ${on ? "outline-2 outline-blue" : ""}`}>
      {children}
      {hint && <span className="text-[13px] font-normal text-muted">{hint}</span>}
    </button>
  );
}

function Step4({ ctx, initialRules, initialKit, preview }: { ctx: Ctx; initialRules: string[]; initialKit: BrandKitValue; preview: SetupPreview | null }) {
  const igResult = useSearchParams().get("ig");
  const [card, setCard] = useState<CardId>(igResult ? "ig" : "tone");
  const [editing, setEditing] = useState(false);
  const [tone, setTone] = useState<Tone | null>(toneOf(ctx.shop.tone));
  // Saved rules that match a preset tick that chip; the rest are the owner's own.
  const [never, setNever] = useState<NeverKey[]>(() => NEVER_KEYS.filter((k) => initialRules.includes(NEVER_PRESETS[k])));
  const [own, setOwn] = useState<string[]>(() => initialRules.filter((r) => !NEVER_KEYS.some((k) => NEVER_PRESETS[k] === r)));
  const [kit, setKit] = useState(initialKit);
  const [look, setLook] = useState<Look | null>(lookOf(initialKit.photo_style));
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const rules = [...never.map((k) => NEVER_PRESETS[k]), ...own.map((r) => r.trim()).filter(Boolean)].slice(0, MAX_RULES);
  const index = CARDS.indexOf(card);
  const move = (to: CardId) => {
    setFailed(false);
    setCard(to);
  };
  // After a confirm: back to the summary when editing from it, otherwise on to the next card.
  const advance = () => {
    setEditing(false);
    move(editing ? "summary" : CARDS[index + 1]);
  };
  const run = (job: () => Promise<boolean>) =>
    start(async () => {
      setFailed(false);
      if (await job()) advance();
      else setFailed(true);
    });

  const confirm = () => {
    if (card === "tone" && tone) run(() => ctx.save({ action: "save", data: { tone } }));
    else if (card === "never") run(() => ctx.save({ action: "save", data: { rules } }));
    else if (card === "look" && look) run(async () => (await saveBrandKit({ ...kit, photo_style: LOOK_PHRASE[look] })).ok);
  };
  const canConfirm = card === "tone" ? tone !== null : card === "look" ? look !== null : true;

  const finish = () =>
    start(async () => {
      setFailed(false);
      const data = tone ? { tone, rules } : { rules };
      if (!(await ctx.save({ action: "finish", data }))) return setFailed(true);
      ctx.go(5);
    });

  const toggleNever = (k: NeverKey) => setNever(never.includes(k) ? never.filter((x) => x !== k) : [...never, k]);
  const edit = (to: CardId) => {
    setEditing(true);
    move(to);
  };

  const product = preview?.name ?? "your product";
  const sample = tone
    ? t(`ob4.sample${tone}` as MessageKey, { product, emoji: never.includes("emojis") ? "" : t("ob4.sampleEmoji") })
    : t("ob4.samplePending");

  const nav = (
    <>
      <Err show={failed} text="ob4.qSaveFailed" />
      <div className="flex flex-col gap-2">
        <Button onClick={confirm} disabled={pending || !canConfirm} aria-busy={pending}>
          {t("ob4.qConfirm")}
        </Button>
        {(card === "never" || card === "look") && (
          <Button variant="text" onClick={advance} disabled={pending}>
            {t("ob4.qSkipQuestion")}
          </Button>
        )}
        {index > 0 && !editing && (
          <Button variant="text" onClick={() => move(CARDS[index - 1])} disabled={pending}>
            {t("ob4.qBack")}
          </Button>
        )}
      </div>
    </>
  );

  const left =
    card === "tone" ? (
      <>
        <h2 className="text-xl font-semibold">{t("ob4.qToneTitle")}</h2>
        <div className="flex flex-col gap-2">
          {TONES.map((x) => (
            <Chip key={x} on={tone === x} onClick={() => setTone(x)}>
              {t(`ob4.tone${x}` as MessageKey)}
            </Chip>
          ))}
        </div>
        {nav}
      </>
    ) : card === "never" ? (
      <>
        <h2 className="text-xl font-semibold">{t("ob4.qNeverTitle")}</h2>
        <p className="text-sm text-muted">{t("ob4.qNeverHint")}</p>
        <div className="flex flex-col gap-2">
          {NEVER_KEYS.map((k) => (
            <Chip key={k} on={never.includes(k)} onClick={() => toggleNever(k)}>
              {t(`ob4.never${k}` as MessageKey)}
            </Chip>
          ))}
        </div>
        {own.map((r, i) => (
          <span key={i} className="flex gap-2">
            <input value={r} onChange={(e) => setOwn(own.map((x, j) => (j === i ? e.target.value : x)))} maxLength={200} placeholder={t("ob4.qOwnRulePlaceholder")} aria-label={t("ob4.qOwnRule")} className={glassInput} />
            <button type="button" aria-label={t("ob4.removeRule", { n: i + 1 })} onClick={() => setOwn(own.filter((_, j) => j !== i))} className="flex size-11 shrink-0 items-center justify-center self-center text-xl text-danger">
              ×
            </button>
          </span>
        ))}
        {never.length + own.length < MAX_RULES && (
          <Button variant="secondary" onClick={() => setOwn([...own, ""])}>
            {own.length ? t("ob4.qAddOwn") : t("ob4.qOwnRule")}
          </Button>
        )}
        {nav}
      </>
    ) : card === "look" ? (
      <>
        <h2 className="text-xl font-semibold">{t("ob4.qLookTitle")}</h2>
        <div className="flex flex-col gap-2">
          {LOOKS.map((k) => (
            <Chip key={k} on={look === k} onClick={() => setLook(k)} hint={t(`ob4.qLook${k === "clean" ? "Clean" : k === "lifestyle" ? "Lifestyle" : "Bold"}Hint` as MessageKey)}>
              {t(`ob4.look${k}` as MessageKey)}
            </Chip>
          ))}
        </div>
        <details className="glass rounded-card p-4">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">{t("ob4.qColours")}</summary>
          <div className="flex flex-col gap-4 pt-3">
            <BrandKitEditor shopId={ctx.shop.id} value={kit} onChange={setKit} hasDescription={Boolean(ctx.shop.description?.trim())} />
          </div>
        </details>
        {nav}
      </>
    ) : card === "ig" ? (
      <>
        <InfoCard vector="social" title={ctx.shop.igConnected ? t("ob4.connectedTitle") : t("ob4.igTitle")}>
          {ctx.shop.igConnected ? t("ob4.connectedCard") : t("ob4.igBody")}
        </InfoCard>
        {!ctx.shop.igConnected && (
          <>
            {igResult === "error" && (
              <p role="alert" className="text-sm text-danger">
                {t("settings.igError")}
              </p>
            )}
            <p className="text-[13px] text-muted">{t("settings.igHint")}</p>
            <AnchorButton variant="secondary" href="/api/auth/instagram?next=onboarding">
              {t("ob4.connect")}
            </AnchorButton>
          </>
        )}
        <Button variant={ctx.shop.igConnected ? "primary" : "text"} onClick={advance}>
          {ctx.shop.igConnected ? t("ob4.qNext") : t("ob4.qSkipIg")}
        </Button>
        {!editing && (
          <Button variant="text" onClick={() => move("look")}>
            {t("ob4.qBack")}
          </Button>
        )}
      </>
    ) : (
      <>
        <h2 className="text-xl font-semibold">{t("ob4.summaryTitle")}</h2>
        <p className="text-sm text-muted">{t("ob4.summaryBody")}</p>
        <ul className="flex flex-col gap-2">
          {(
            [
              ["tone", tone ? t("ob4.summaryTone", { tone: t(`ob4.tone${tone}` as MessageKey).toLowerCase() }) : t("ob4.summaryToneNone")],
              ["never", rules.length ? t("ob4.summaryRules", { rules: rules.join("; ") }) : t("ob4.summaryRulesNone")],
              ["look", look ? t("ob4.summaryLook", { look: t(`ob4.look${look}` as MessageKey).toLowerCase() }) : t("ob4.summaryLookNone")],
              ["ig", t("ob4.summaryIg", { state: t(ctx.shop.igConnected ? "ob4.igStateOn" : "ob4.igStateOff") })],
            ] as [CardId, string][]
          ).map(([id, line]) => (
            <li key={id} className="glass flex items-center justify-between gap-3 rounded-card p-3.5">
              <span className="text-[15px]">{line}</span>
              <Button variant="text" onClick={() => edit(id)} disabled={pending}>
                {t("ob4.summaryEdit")}
              </Button>
            </li>
          ))}
        </ul>
        <Err show={failed} />
        <Button onClick={finish} disabled={pending} aria-busy={pending}>
          {t("ob4.summaryFinish")}
        </Button>
      </>
    );

  return (
    <>
      <Head title={t("ob4.title")} body={card === "summary" ? t("ob4.summaryBody") : t("ob4.progress", { n: index + 1, total: CARDS.length })} />
      <Split
        left={left}
        right={
          <section className="glass flex flex-col gap-3 rounded-card p-5">
            <h2 className="text-lg font-semibold">{t("ob4.sampleIntro")}</h2>
            <div className="flex items-center gap-3">
              {preview?.cutout && (
                <span className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded-control bg-[radial-gradient(circle_at_30%_40%,#e5f0ff,#f9f9ff)]">
                  <Image src={preview.cutout} alt={preview.name} fill sizes="64px" className="object-contain" />
                </span>
              )}
              <p className="text-[15px] text-muted">{sample}</p>
            </div>
          </section>
        }
      />
    </>
  );
}

// First post + tour (228:17081, 228:17182, 228:17301): runs on a labelled sample while the real post generates (FR-OB-09).
function Step5({ ctx, preview }: { ctx: Ctx; preview: SetupPreview | null }) {
  const router = useRouter();
  const [tour, setTour] = useState<1 | 2 | 3>(1);
  const [showFailed, setShowFailed] = useState(false);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  // The first slide is still being made: re-read the page until it lands (tour state is kept across refreshes).
  const stalled = Boolean(preview?.stalled);
  const waiting = Boolean(preview) && !stalled && !preview?.slide && (preview?.postStatus === "generating" || (preview?.postStatus == null && !ctx.shop.completed));
  const [retrying, startRetry] = useTransition();
  const [retryFailed, setRetryFailed] = useState(false);
  // The route fails the dead post and starts a new one; the refresh picks it up and polling resumes.
  const retry = () =>
    startRetry(async () => {
      setRetryFailed(false);
      const res = await fetch(`/api/shops/${ctx.shop.id}/posts/generate`, { method: "POST" }).catch(() => null);
      if (!res?.ok) return setRetryFailed(true);
      router.refresh();
    });

  // Replay tour (Settings) must not start another post.
  useEffect(() => {
    if (started.current || ctx.shop.completed) return;
    started.current = true;
    void fetch(`/api/shops/${ctx.shop.id}/posts/generate`, { method: "POST" }).catch(() => null);
  }, [ctx.shop.id, ctx.shop.completed]);

  // A run takes 3-5 minutes (plus queue time), so poll for up to 10 like Today's AutoRefresh;
  // the old ~3 minute cap stopped seconds before the slide landed and left "Building slide 1" up.
  useEffect(() => {
    if (!waiting) return;
    const until = Date.now() + 10 * 60_000;
    const id = setInterval(() => (Date.now() > until ? clearInterval(id) : router.refresh()), 4000);
    return () => clearInterval(id);
  }, [waiting, router]);

  // The owner's product: the real first slide once built, otherwise the confirmed cutout being worked on.
  const after = preview?.slide ?? preview?.cutout ?? null;
  const afterCaption = preview?.slide ? t("ob5.afterCaption") : t("ob5.afterWorking");
  const realPost = preview ? (
    <div className="flex flex-col gap-4">
      <RealPhoto
        src={after}
        alt={preview.name}
        eyebrow={t("ob5.realEyebrow")}
        caption={preview.slide ? preview.name : stalled ? t("ob5.stalled") : t("ob5.realWorking", { product: preview.name })}
        working={!preview.slide && !stalled}
      />
      {stalled && (
        <div className="flex flex-col gap-1 lg:max-w-75">
          <Button variant="secondary" onClick={retry} disabled={retrying} aria-busy={retrying}>
            {t("status.stalled.action")}
          </Button>
          <Err show={retryFailed} />
        </div>
      )}
    </div>
  ) : (
    <Guide eyebrow={t("ob5.sampleEyebrow")} caption={t("ob5.sample")} />
  );

  const finish = (action: "finish" | "skip") =>
    start(async () => {
      setFailed(false);
      if (!(await ctx.save(action === "finish" ? { action, tour_completed: true } : { action }))) return setFailed(true);
      ctx.go(6);
    });


  if (tour === 3) {
    return (
      <div className="flex flex-col gap-5 lg:max-w-180">
        <Head title={t("ob5.stepsTitle")} body={t("ob5.stepsBody")} />
        <p className="text-xs font-semibold text-blue">{t("ob5.stepsTag")}</p>
        <Stages />
        <Stage icon="details" title={t("activity.s6")} body={t("activity.s6Body")} />
        <Err show={failed} />
        <Button onClick={() => finish("finish")} disabled={pending} aria-busy={pending}>
          {t("ob5.finish")}
        </Button>
        <Button variant="secondary" onClick={() => setTour(2)}>
          {t("ob5.accuracy")}
        </Button>
      </div>
    );
  }

  if (tour === 2) {
    return (
      <>
        <Head title={t("ob5.badgeTitle")} body={t("ob5.badgeBody")} />
        <Split
          left={
            <div className="flex flex-col gap-6 lg:flex-row">
              {preview ? (
                <>
                  <RealPhoto src={preview.photo ?? preview.cutout} alt={preview.name} eyebrow={t("ob5.beforeReal")} caption={t("ob5.beforeCaption")} />
                  <RealPhoto src={after} alt={preview.name} eyebrow={t("ob5.afterReal")} caption={afterCaption} working={!preview.slide} />
                </>
              ) : (
                <>
                  <Guide eyebrow={t("ob5.before")} caption={t("ob5.beforeCaption")} />
                  <Guide eyebrow={t("ob5.after")} caption={t("ob5.afterCaption")} />
                </>
              )}
            </div>
          }
          right={
            <>
              <InfoCard vector="check" title={t("ob5.passedTitle")}>
                {t("ob5.passedBody")}
              </InfoCard>
              {showFailed && (
                <InfoCard vector="details" title={t("ob5.failedTitle")}>
                  {t("ob5.failedBody")}
                </InfoCard>
              )}
              <Button onClick={() => setTour(3)}>{t("ob5.next2")}</Button>
              <Button variant="text" onClick={() => setShowFailed(!showFailed)} aria-expanded={showFailed}>
                {t("ob5.viewFailed")}
              </Button>
            </>
          }
        />
      </>
    );
  }

  return (
    <>
      <Head title={t("ob5.title")} body={preview ? t("ob5.bodyReal") : t("ob5.body")} />
      <Split
        left={realPost}
        right={
          <>
            <section className="glass flex flex-col gap-2 rounded-card p-5">
              <h2 className="text-lg font-semibold">{t("ob5.tour1")}</h2>
              <p className="text-[15px] text-muted">{t("ob5.tour1Body")}</p>
            </section>
            <Err show={failed} />
            <Button onClick={() => setTour(2)}>{t("ob5.next1")}</Button>
            <Button variant="text" onClick={() => finish("skip")} disabled={pending}>
              {t("ob5.skip")}
            </Button>
          </>
        }
      />
    </>
  );
}
