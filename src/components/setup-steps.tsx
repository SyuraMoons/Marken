"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "./button";
import { Carousel } from "./carousel";
import { ProductCheck } from "./product-check";
import { t, type MessageKey } from "@/lib/i18n";
import { mockPost, mockProductPhoto, mockProducts } from "@/lib/mock";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";

// All 5 onboarding steps (F-03, FR-OB). Presentational on mocks; saving per step is Harfi's PATCH onboarding route.
export function SetupSteps({ step }: { step: number }) {
  const router = useRouter();
  const next = () => router.push(step < 5 ? `/onboarding/${step + 1}` : "/today");

  return (
    <div className="flex flex-col gap-5 pb-8">
      {step === 1 && <Step1 />}
      {step === 2 && <Step2 onNext={next} />}
      {step === 3 && <Step3 onNext={next} />}
      {step === 4 && <Step4 onNext={next} />}
      {step === 5 && <Step5 />}
      {step === 1 && <Button onClick={next}>{t("ob.continue")}</Button>}
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

function Step1() {
  return (
    <>
      <Head title="ob1.title" body="ob1.body" />
      <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
        <label className={label}>
          {t("ob1.name")} · {t("ob.required")}
          <input name="name" required defaultValue="Rani Studio" className={input} autoComplete="organization" />
        </label>
        <label className={label}>
          {t("ob1.category")} · {t("ob.required")}
          <select name="category" className={input} defaultValue="Beauty">
            {["Food & drinks", "Fashion", "Beauty", "Crafts", "Home", "Other"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t("ob1.country")} · {t("ob.required")}
          <select name="country" className={input} defaultValue="Indonesia">
            {["Indonesia", "Malaysia", "Singapore", "Philippines", "Thailand", "Other"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">
            {t("ob1.language")} · {t("ob.required")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["id", "Bahasa Indonesia"],
              ["en", "English"],
            ].map(([v, l], i) => (
              <label key={v} className="flex h-13 cursor-pointer items-center justify-center rounded-control border border-border bg-white text-sm font-medium has-checked:border-blue has-checked:bg-powder has-checked:text-blue">
                <input type="radio" name="language" value={v} defaultChecked={i === 0} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label className={label}>
          {t("ob1.timezone")} · {t("ob.required")}
          <select name="time_zone" className={input} defaultValue="Asia/Jakarta">
            {["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur"].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

function Step2({ onNext }: { onNext: () => void }) {
  const [photos, setPhotos] = useState([1, 2, 3]);
  const ok = photos.length >= 3;

  return (
    <>
      <Head title="ob2.title" body="ob2.body" />
      <p className="text-sm font-medium text-muted">{t("ob2.count", { n: photos.length })}</p>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((id, i) => (
          <figure key={id} className="relative aspect-square overflow-hidden rounded-control bg-white">
            <Image src={mockProductPhoto.src} alt={t("ob2.photo", { n: i + 1 })} fill sizes="160px" className="object-cover" />
            <button
              type="button"
              onClick={() => setPhotos(photos.filter((p) => p !== id))}
              aria-label={t("ob2.remove", { n: i + 1 })}
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-lg text-ink"
            >
              <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white/90">×</span>
            </button>
          </figure>
        ))}
      </div>
      {photos.length < 10 && (
        <Button variant="secondary" onClick={() => setPhotos([...photos, Math.max(0, ...photos) + 1])}>
          {t("ob2.add")}
        </Button>
      )}
      {!ok && (
        <p role="alert" className="text-sm text-danger">
          {t("ob2.need")}
        </p>
      )}
      <Button onClick={onNext} disabled={!ok}>
        {t("ob.continue")}
      </Button>
    </>
  );
}

function Step3({ onNext }: { onNext: () => void }) {
  const [items, setItems] = useState(mockProducts);
  const done = items.length > 0 && items.every((p) => p.cutout_confirmed);
  // Last unconfirmed card gets the "continue" wording instead of "next photo" (DX-09).
  const confirmLabel = items.filter((p) => !p.cutout_confirmed).length > 1 ? t("ob3.confirm") : `${t("ob3.confirm")} · ${t("ob.continue").toLowerCase()}`;

  return (
    <>
      <Head title="ob3.title" body="ob3.body" />
      {items.map((p) => (
        <article key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-white p-4">
          <div className="flex gap-4">
            <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-control bg-surface">
              {p.cutout_path && <Image src={p.cutout_path} alt={p.name} fill sizes="96px" className="object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <label className="sr-only" htmlFor={`name-${p.id}`}>
                {t("ob3.name")}
              </label>
              <input
                id={`name-${p.id}`}
                defaultValue={p.name}
                className="h-11 w-full rounded-control border border-border bg-white px-3 text-sm font-medium focus:outline-2 focus:outline-blue"
              />
              <p className="text-sm text-muted">{p.price == null ? t("ob3.noPrice") : `IDR ${p.price.toLocaleString("id-ID")}`}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={p.cutout_confirmed ? "secondary" : "primary"}
              onClick={() => setItems(items.map((x) => (x.id === p.id ? { ...x, cutout_confirmed: !x.cutout_confirmed } : x)))}
              aria-pressed={p.cutout_confirmed}
            >
              {p.cutout_confirmed ? `✓ ${t("ob3.confirmed")}` : confirmLabel}
            </Button>
            <Button variant="text" className="text-danger!" onClick={() => setItems(items.filter((x) => x.id !== p.id))}>
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
      <Button onClick={onNext} disabled={!done}>
        {t("ob.continue")}
      </Button>
    </>
  );
}

const TONES = ["Warm", "Playful", "Elegant", "Casual"] as const;

function Step4({ onNext }: { onNext: () => void }) {
  const [tone, setTone] = useState<(typeof TONES)[number]>("Warm");
  const [rules, setRules] = useState<string[]>(["Never show prices"]);
  const [draft, setDraft] = useState("");
  const [ig, setIg] = useState(false);

  const add = () => {
    const r = draft.trim();
    if (r && rules.length < 10) setRules([...rules, r]);
    setDraft("");
  };

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
            <input id="rule" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder={t("ob4.rulePlaceholder")} className={input} />
            <Button variant="secondary" className="w-auto! shrink-0 px-4" onClick={add} disabled={!draft.trim() || rules.length >= 10}>
              {t("ob4.addRule")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-control bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            {t("ob4.sample")} · {t(`ob4.tone${tone}` as MessageKey)}
          </p>
          <p className="text-sm">{t("ob4.sampleText")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-white p-5">
        <p className="font-medium">{t("ob4.ig")}</p>
        {ig ? (
          <p className="flex min-h-11 items-center gap-2 text-sm font-medium text-blue">
            <span aria-hidden="true">✓</span> {t("ob4.connected")} · rani.studio
          </p>
        ) : (
          <Button variant="secondary" onClick={() => setIg(true)}>
            {t("ob4.connect")}
          </Button>
        )}
      </div>

      <Button onClick={onNext}>{t("ob.continue")}</Button>
      <ButtonLink href="/onboarding/5" variant="text">
        {t("ob4.skip")}
      </ButtonLink>
    </>
  );
}

function Step5() {
  const [tour, setTour] = useState(1);
  const slides = asSlides(mockPost.slides);

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

      <ButtonLink href="/today">{t("ob5.finish")}</ButtonLink>
      <ButtonLink href="/today" variant="text">
        {t("ob5.skip")}
      </ButtonLink>
    </>
  );
}
