"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./button";
import { Carousel } from "./carousel";
import { ProductCheck } from "./product-check";
import { deleteProduct, saveProduct, setCutoutConfirmed } from "@/lib/actions/products";
import type { ProductView } from "@/lib/data/products";
import { t, type MessageKey } from "@/lib/i18n";
import { mockPost, mockProductPhoto } from "@/lib/mock";
import { asTone, CATEGORIES, COUNTRIES, TIME_ZONES, TONES, type Tone } from "@/lib/options";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";
import { ACCEPT, patchOnboarding, uploadAndExtract, validPhoto } from "@/lib/upload";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";

export type SetupShop = {
  id: string;
  name: string;
  category: string | null;
  country: string | null;
  content_language: "en" | "id";
  time_zone: string | null;
  tone: string | null;
  igConnected: boolean;
};

type Ctx = { shop: SetupShop; go: (step: number) => void; save: (body: Record<string, unknown>) => Promise<boolean> };

// All 5 onboarding steps (F-03, FR-OB). Each step saves server-side before moving on (FR-OB-11).
export function SetupSteps({ step, shop, products, rules }: { step: number; shop: SetupShop; products: ProductView[]; rules: string[] }) {
  const router = useRouter();
  const ctx: Ctx = {
    shop,
    go: (n) => router.push(n > 5 ? "/today" : `/onboarding/${n}`),
    save: (body) => patchOnboarding(shop.id, { step, ...body }),
  };

  // Logs the step start (FR-OB-12); a repeat visit is ignored by the route.
  useEffect(() => {
    void patchOnboarding(shop.id, { step, action: "start" });
  }, [shop.id, step]);

  return (
    <div className="flex flex-col gap-5 pb-8">
      {step === 1 && <Step1 ctx={ctx} />}
      {step === 2 && <Step2 ctx={ctx} hasProducts={products.length > 0} />}
      {step === 3 && <Step3 ctx={ctx} initial={products} />}
      {step === 4 && <Step4 ctx={ctx} initialRules={rules} />}
      {step === 5 && <Step5 ctx={ctx} />}
    </div>
  );
}

function Head({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">{t(title as MessageKey)}</h1>
      <p className="text-muted">{t(body as MessageKey)}</p>
    </div>
  );
}

const Err = ({ show, text = "common.error" }: { show: boolean; text?: MessageKey }) =>
  show ? (
    <p role="alert" className="text-sm text-danger">
      {t(text)}
    </p>
  ) : null;

function Step1({ ctx }: { ctx: Ctx }) {
  const { shop } = ctx;
  const [name, setName] = useState(shop.name);
  const [category, setCategory] = useState(shop.category ?? CATEGORIES[0]);
  const [country, setCountry] = useState(shop.country ?? COUNTRIES[0]);
  const [language, setLanguage] = useState<"en" | "id">(shop.content_language);
  const [zone, setZone] = useState(shop.time_zone ?? "");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const submit = () =>
    start(async () => {
      setFailed(false);
      const ok = await ctx.save({ action: "finish", data: { name, category, country, content_language: language, time_zone: zone || Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!ok) return setFailed(true);
      ctx.go(2);
    });

  return (
    <>
      <Head title="ob1.title" body="ob1.body" />
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
          <label className={label}>
            {t("ob1.name")} · {t("ob.required")}
            <input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="organization" />
          </label>
          <label className={label}>
            {t("ob1.category")} · {t("ob.required")}
            <select name="category" className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {[...new Set([category, ...CATEGORIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("ob1.country")} · {t("ob.required")}
            <select name="country" className={input} value={country} onChange={(e) => setCountry(e.target.value)}>
              {[...new Set([country, ...COUNTRIES])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">
              {t("ob1.language")} · {t("ob.required")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["id", "Bahasa Indonesia"],
                  ["en", "English"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className="flex h-13 cursor-pointer items-center justify-center rounded-control border border-border bg-white text-sm font-medium has-checked:border-blue has-checked:bg-powder has-checked:text-blue has-focus-visible:outline-2 has-focus-visible:outline-blue">
                  <input type="radio" name="language" value={v} checked={language === v} onChange={() => setLanguage(v)} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={label}>
            {t("ob1.timezone")} · {t("ob.required")}
            <select name="time_zone" className={input} value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">{t("ob1.tzAuto")}</option>
              {[...new Set([zone, ...TIME_ZONES])].filter(Boolean).map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
        </div>
        <Err show={failed} />
        <Button type="submit" disabled={pending || !name.trim()} aria-busy={pending}>
          {t("ob.continue")}
        </Button>
      </form>
    </>
  );
}

type Photo = { id: number; file: File; url: string };

function Step2({ ctx, hasProducts }: { ctx: Ctx; hasProducts: boolean }) {
  const pick = useRef<HTMLInputElement>(null);
  const next = useRef(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, start] = useTransition();
  const ok = photos.length >= 3;

  // Free the preview blobs on leave.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);

  const add = (files: FileList | null) => {
    if (!files) return;
    const good = Array.from(files).filter(validPhoto);
    setError(good.length < files.length ? "ob2.badFile" : null);
    const room = 10 - photos.length;
    const added = good.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: next.current++, file, url };
    });
    setPhotos([...photos, ...added]);
    if (pick.current) pick.current.value = "";
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await uploadAndExtract(ctx.shop.id, photos.map((p) => p.file)).catch(() => null);
      if (!res || res.products.length === 0) return setError("ob2.failed");
      if (!(await ctx.save({ action: "finish" }))) return setError("common.error");
      ctx.go(3);
    });

  return (
    <>
      <Head title="ob2.title" body="ob2.body" />
      {hasProducts && photos.length === 0 && <p className="rounded-card border border-border bg-white p-4 text-sm">{t("ob2.have")}</p>}
      <p className="text-sm font-medium text-muted">{t("ob2.count", { n: photos.length })}</p>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <figure key={p.id} className="relative aspect-square overflow-hidden rounded-control bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={p.url} alt={t("ob2.photo", { n: i + 1 })} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}
              disabled={pending}
              aria-label={t("ob2.remove", { n: i + 1 })}
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-lg text-ink"
            >
              <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white/90">×</span>
            </button>
          </figure>
        ))}
      </div>
      <input ref={pick} type="file" accept={ACCEPT} multiple className="sr-only" aria-label={t("ob2.choose")} onChange={(e) => add(e.target.files)} />
      {photos.length < 10 && (
        <Button variant="secondary" onClick={() => pick.current?.click()} disabled={pending}>
          {t(photos.length ? "ob2.add" : "ob2.choose")}
        </Button>
      )}
      {!ok && !hasProducts && <p className="text-sm text-muted">{t("ob2.need")}</p>}
      {pending && <p role="status" className="text-sm text-muted">{t("ob2.uploading")}</p>}
      <Err show={Boolean(error)} text={error ?? undefined} />
      {ok || photos.length === 0 ? (
        <Button onClick={ok ? submit : () => ctx.go(3)} disabled={pending || (!ok && !hasProducts)} aria-busy={pending}>
          {t("ob.continue")}
        </Button>
      ) : (
        <Button disabled>{t("ob.continue")}</Button>
      )}
    </>
  );
}

function Step3({ ctx, initial }: { ctx: Ctx; initial: ProductView[] }) {
  const [items, setItems] = useState(initial);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const done = items.length > 0 && items.every((p) => p.cutout_confirmed);

  const patch = (id: string, change: Partial<ProductView>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const act = (job: () => Promise<{ ok: boolean }>, after: () => void) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => ({ ok: false }));
      if (!res.ok) return setFailed(true);
      after();
    });

  const rename = (p: ProductView, name: string) => {
    const clean = name.trim();
    if (!clean || clean === p.name) return;
    act(() => saveProduct({ id: p.id, name: clean }), () => patch(p.id, { name: clean }));
  };

  const reprice = (p: ProductView, raw: string) => {
    const price = raw.trim() === "" ? null : Number(raw);
    if (price !== null && !(price > 0)) return setFailed(true);
    if (price === (p.price == null ? null : Number(p.price))) return;
    act(() => saveProduct({ id: p.id, name: p.name, price }), () => patch(p.id, { price }));
  };

  const finish = () =>
    start(async () => {
      setFailed(false);
      if (!(await ctx.save({ action: "finish" }))) return setFailed(true);
      ctx.go(4);
    });

  return (
    <>
      <Head title="ob3.title" body="ob3.body" />
      {items.map((p) => (
        <article key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-white p-4">
          <div className="flex gap-4">
            <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-control bg-surface">
              {p.cutout_url && <Image src={p.cutout_url} alt={p.name} fill sizes="96px" className="object-contain" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="sr-only" htmlFor={`name-${p.id}`}>
                {t("ob3.name")}
              </label>
              <input
                id={`name-${p.id}`}
                defaultValue={p.name}
                onBlur={(e) => rename(p, e.target.value)}
                className="h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-medium focus:outline-2 focus:outline-blue"
              />
              <label className="sr-only" htmlFor={`price-${p.id}`}>
                {t("ob3.price")}
              </label>
              <input
                id={`price-${p.id}`}
                defaultValue={p.price != null ? String(Number(p.price)) : ""}
                inputMode="decimal"
                placeholder={t("ob3.noPrice")}
                onBlur={(e) => reprice(p, e.target.value.replace(/[^0-9.]/g, ""))}
                className="h-11 w-full rounded-control border border-border bg-white px-3 text-sm focus:outline-2 focus:outline-blue"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={p.cutout_confirmed ? "secondary" : "primary"}
              disabled={pending}
              onClick={() => act(() => setCutoutConfirmed(p.id, !p.cutout_confirmed), () => patch(p.id, { cutout_confirmed: !p.cutout_confirmed }))}
              aria-pressed={p.cutout_confirmed}
            >
              {p.cutout_confirmed ? `✓ ${t("ob3.confirmed")}` : t("ob3.confirm")}
            </Button>
            <Button variant="text" className="text-danger!" disabled={pending} onClick={() => act(() => deleteProduct(p.id), () => setItems((cur) => cur.filter((x) => x.id !== p.id)))}>
              {t("ob3.delete")}
            </Button>
          </div>
        </article>
      ))}
      {!done && (
        <p role="alert" className="text-sm text-danger">
          {t("ob3.need")}
        </p>
      )}
      <Err show={failed} />
      <Button onClick={finish} disabled={!done || pending} aria-busy={pending}>
        {t("ob.continue")}
      </Button>
    </>
  );
}

function Step4({ ctx, initialRules }: { ctx: Ctx; initialRules: string[] }) {
  const [tone, setTone] = useState<Tone>(asTone(ctx.shop.tone));
  const [rules, setRules] = useState<string[]>(initialRules);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  const add = () => {
    const r = draft.trim();
    if (r && rules.length < 10 && !rules.includes(r)) setRules([...rules, r]);
    setDraft("");
  };

  const finish = (action: "finish" | "skip") =>
    start(async () => {
      setFailed(false);
      const ok = await ctx.save(action === "finish" ? { action, data: { tone, rules } } : { action });
      if (!ok) return setFailed(true);
      ctx.go(5);
    });

  return (
    <>
      <Head title="ob4.title" body="ob4.body" />
      <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">{t("ob4.tone")}</legend>
          <div className="flex flex-wrap gap-2">
            {TONES.map((x) => (
              <label key={x} className={`flex h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-blue ${tone === x ? "border-blue bg-powder text-blue" : "border-border bg-white text-ink"}`}>
                <input type="radio" name="tone" checked={tone === x} onChange={() => setTone(x)} className="sr-only" />
                {t(`ob4.tone${x}` as MessageKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="rule">
            {t("ob4.rules")}
          </label>
          <ul className="flex flex-col gap-1.5">
            {rules.map((r) => (
              <li key={r} className="flex min-h-11 items-center justify-between gap-2 rounded-control bg-surface px-3 text-sm">
                <span>{r}</span>
                <button type="button" aria-label={t("ob4.removeRule", { rule: r })} onClick={() => setRules(rules.filter((x) => x !== r))} className="flex size-11 shrink-0 items-center justify-center text-danger">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input id="rule" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} maxLength={200} placeholder={t("ob4.rulePlaceholder")} className={input} />
            <Button variant="secondary" className="w-auto! shrink-0 px-4" onClick={add} disabled={!draft.trim() || rules.length >= 10}>
              {t("ob4.addRule")}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-white p-5">
        <p className="font-medium">{t("ob4.ig")}</p>
        {ctx.shop.igConnected ? (
          <p className="flex min-h-11 items-center gap-2 text-sm font-medium text-blue">
            <span aria-hidden="true">✓</span> {t("ob4.connected")}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("settings.igSoon")}</p>
        )}
      </div>

      <Err show={failed} />
      <Button onClick={() => finish("finish")} disabled={pending} aria-busy={pending}>
        {t("ob.continue")}
      </Button>
      <Button variant="text" onClick={() => finish("skip")} disabled={pending}>
        {t("ob4.skip")}
      </Button>
    </>
  );
}

function Step5({ ctx }: { ctx: Ctx }) {
  const [tour, setTour] = useState(1);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const slides = asSlides(mockPost.slides);
  const started = useRef(false);

  // The real post starts generating now; the tour runs on a labelled sample meanwhile (FR-OB-09).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch(`/api/shops/${ctx.shop.id}/posts/generate`, { method: "POST" }).catch(() => null);
  }, [ctx.shop.id]);

  const finish = (action: "finish" | "skip") =>
    start(async () => {
      setFailed(false);
      const ok = await ctx.save(action === "finish" ? { action, tour_completed: true } : { action });
      if (!ok) return setFailed(true);
      ctx.go(6);
    });

  return (
    <>
      <Head title="ob5.title" body="ob5.body" />
      <section aria-label={t("ob5.sample")} className="relative flex flex-col gap-3 rounded-card border border-border bg-white p-5">
        <span className="absolute top-3 left-3 z-10 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">{t("ob5.sample")}</span>
        <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} />
        {allSlidesPassed(slides) && (
          <ProductCheck photo={mockProductPhoto} slide={slides[1]} labels={{ badge: t("today.badge"), before: t("today.before"), after: t("today.after") }} />
        )}
      </section>

      <div className="flex flex-col gap-2 rounded-card border border-blue bg-powder/50 p-4" role="note">
        <p className="text-xs font-medium tracking-wide text-blue uppercase">{t("tour.step", { n: tour })}</p>
        <p className="text-sm">{t(`tour.${tour}` as MessageKey)}</p>
        {tour < 3 && (
          <Button variant="text" className="w-auto! self-start px-0" onClick={() => setTour(tour + 1)}>
            {t("ob5.next")}
          </Button>
        )}
      </div>

      <Err show={failed} />
      <Button onClick={() => finish("finish")} disabled={pending} aria-busy={pending}>
        {t("ob5.finish")}
      </Button>
      <Button variant="text" onClick={() => finish("skip")} disabled={pending}>
        {t("ob5.skip")}
      </Button>
    </>
  );
}

