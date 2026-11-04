"use client";

import { BrandKitEditor } from "./brand-kit-editor";
import { saveBrandKit } from "@/lib/actions/brand-kit";
import type { BrandKitValue } from "@/lib/brand-kit";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { saveBrand, saveReminder, saveShop } from "@/app/(app)/settings/actions";
import { AnchorButton, Button, ButtonLink } from "./button";
import { Field, glassInput } from "./field";
import { InfoCard } from "./info-card";
import { InstallMarken } from "./install-marken";
import { PageHeader } from "./page-header";
import { StatusScreen } from "./status-screen";
import { t, type MessageKey } from "@/lib/i18n";
import { asTone, CATEGORIES, COUNTRIES, TIME_ZONES, TONES, type Tone } from "@/lib/options";

// shortcut: motion choice lives in localStorage until a server-side preference exists.
const MOTION_EVENT = "marken-motion";
const subscribeMotion = (cb: () => void) => {
  window.addEventListener(MOTION_EVENT, cb);
  return () => window.removeEventListener(MOTION_EVENT, cb);
};
function readMotion() {
  try {
    const saved = localStorage.getItem("marken-motion");
    return saved ? saved === "reduce" : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
function setMotion(on: boolean) {
  try {
    localStorage.setItem("marken-motion", on ? "reduce" : "full");
  } catch {}
  window.dispatchEvent(new Event(MOTION_EVENT));
}

type View = "main" | "shop" | "brand" | "instagram" | "reminders" | "account" | "delete" | "deleted";
type Lang = "en" | "id";

type Props = {
  email: string;
  igConnected: boolean;
  rules: string[];
  brandKit: BrandKitValue;
  hasDescription: boolean;
  shop: { id: string; name: string; category: string; country: string; time_zone: string; content_language: Lang; tone: string | null; notify_time: string };
};

// Settings (Figma page 04, F-15). Saves go through owner-scoped server actions.
export function SettingsView({ email, igConnected, rules: savedRules, brandKit, hasDescription, shop }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const igResult = useSearchParams().get("ig");
  const [view, setView] = useState<View>(igResult ? "instagram" : "main");
  const [name, setName] = useState(shop.name);
  const [category, setCategory] = useState(shop.category);
  const [country, setCountry] = useState(shop.country);
  const [lang, setLang] = useState<Lang>(shop.content_language);
  const [zone, setZone] = useState(shop.time_zone);
  const [tone, setTone] = useState<Tone>(asTone(shop.tone));
  const [rules, setRules] = useState<string[]>(savedRules.length ? savedRules : [""]);
  const [kit, setKit] = useState(brandKit);
  const [time, setTime] = useState(shop.notify_time);
  const [typed, setTyped] = useState("");
  const [next, setNext] = useState<{ id: string; name: string } | null>(null);
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, () => false);

  const go = (v: View) => {
    setFailed(false);
    setView(v);
  };

  const run = (job: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => ({ ok: false }));
      if (!res.ok) return setFailed(true);
      router.refresh();
      setView("main");
    });

  const remove = () =>
    start(async () => {
      setFailed(false);
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }).catch(() => null);
      if (!res?.ok) return setFailed(true);
      const body = (await res.json().catch(() => null)) as { next?: { id: string; name: string } | null } | null;
      setNext(body?.next ?? null);
      setView("deleted");
    });

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduce" : "full";
  }, [reduceMotion]);

  const error = failed && (
    <p role="alert" className="text-sm text-danger">
      {t("common.error")}
    </p>
  );
  const cancel = (
    <Button variant="text" onClick={() => go("main")}>
      {t("settings.cancel")}
    </Button>
  );

  // The organization has been deleted (228:15840). Full page loads: nothing from the deleted
  // organization may linger in cached layouts, and the proxy routes an unfinished one to its setup.
  if (view === "deleted") {
    return (
      <StatusScreen title={t("settings.deletedTitle")} body={t("settings.deletedBody")}>
        <InfoCard vector="build" title={t("settings.deletedCardTitle")}>
          {t("settings.deletedCardBody")}
        </InfoCard>
        {next ? (
          <AnchorButton href="/posts">{t("settings.continueOther", { name: next.name || t("nav.newCompany") })}</AnchorButton>
        ) : (
          <AnchorButton href="/">{t("settings.startAgain")}</AnchorButton>
        )}
      </StatusScreen>
    );
  }

  // Delete this organization? (228:15761): typing its name unlocks the button.
  if (view === "delete") {
    return (
      <StatusScreen title={t("settings.deleteTitle")} body={t("settings.deleteBody")}>
        <InfoCard vector="details" title={t("settings.deleteCardTitle")}>
          {t("settings.deleteCardBody")}
        </InfoCard>
        <Field n={1} cue="shop" label={t("settings.deleteType")}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={shop.name} autoComplete="off" className={glassInput} />
        </Field>
        {error}
        <Button variant="danger" onClick={remove} disabled={pending || typed.trim() !== shop.name.trim()} aria-busy={pending}>
          {t("settings.deleteConfirm")}
        </Button>
        <Button variant="secondary" onClick={() => go("main")}>
          {t("settings.keepShop")}
        </Button>
      </StatusScreen>
    );
  }

  // Organization details (228:15162)
  if (view === "shop") {
    return (
      <StatusScreen title={t("settings.shopTitle")} body={t("settings.shopBody")}>
        <Field n={1} cue="shop" label={t("settings.name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={glassInput} />
        </Field>
        <Field n={2} cue="tag" label={t("settings.category")}>
          <Select value={category} onChange={setCategory} options={[...new Set([category, ...CATEGORIES])]} />
        </Field>
        <Field n={3} cue="globe" label={t("settings.country")}>
          <Select value={country} onChange={setCountry} options={[...new Set([country, ...COUNTRIES])]} />
        </Field>
        <Field n={4} cue="text" label={t("settings.language")}>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={glassInput}>
            <option value="en">{t("settings.langEn")}</option>
            <option value="id">{t("settings.langId")}</option>
          </select>
        </Field>
        <Field n={5} cue="clock" label={t("settings.timezone")}>
          <Select value={zone} onChange={setZone} options={[...new Set([zone, ...TIME_ZONES])]} />
        </Field>
        {error}
        <Button onClick={() => run(() => saveShop({ name, category, country, time_zone: zone, content_language: lang }))} disabled={pending || !name.trim()} aria-busy={pending}>
          {t("settings.saveShop")}
        </Button>
        {cancel}
        <Button variant="text" className="text-danger!" onClick={() => go("delete")}>
          {t("settings.deleteOrg")}
        </Button>
      </StatusScreen>
    );
  }

  // Writing style and rules (228:15341)
  if (view === "brand") {
    return (
      <StatusScreen title={t("settings.brandTitle")} body={t("settings.brandBody")}>
        <BrandKitEditor shopId={shop.id} value={kit} onChange={setKit} hasDescription={hasDescription} />
        <Field n={5} cue="voice" label={t("settings.tone")}>
          <select value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={glassInput}>
            {TONES.map((x) => (
              <option key={x} value={x}>
                {t(`ob4.tone${x}` as MessageKey)}
              </option>
            ))}
          </select>
        </Field>
        {rules.map((r, i) => (
          <Field key={i} n={i + 6} cue="rules" label={t("settings.rule", { n: i + 1 })}>
            <span className="flex gap-2">
              <input value={r} onChange={(e) => setRules(rules.map((x, j) => (j === i ? e.target.value : x)))} maxLength={200} placeholder={t("settings.rulePlaceholder")} className={glassInput} />
              {rules.length > 1 && (
                <button type="button" aria-label={t("settings.removeRule", { n: i + 1 })} onClick={() => setRules(rules.filter((_, j) => j !== i))} className="flex size-11 shrink-0 items-center justify-center self-center text-xl text-danger">
                  ×
                </button>
              )}
            </span>
          </Field>
        ))}
        <p className="text-[13px] text-muted">{t("settings.ruleHint")}</p>
        {rules.length < 10 && (
          <Button variant="secondary" onClick={() => setRules([...rules, ""])}>
            {t("settings.addRule")}
          </Button>
        )}
        <InfoCard vector="voice" title={t("ob4.sample")}>
          {t("ob4.sampleText")}
        </InfoCard>
        {error}
        <Button onClick={() => run(async () => ((await saveBrandKit(kit)).ok ? saveBrand({ tone, rules: rules.map((r) => r.trim()).filter(Boolean) }) : { ok: false }))} disabled={pending} aria-busy={pending}>
          {t("settings.saveBrand")}
        </Button>
        {cancel}
      </StatusScreen>
    );
  }

  // Connect Instagram / Instagram connected (228:15494)
  if (view === "instagram") {
    return igConnected ? (
      <StatusScreen title={t("settings.igConnectedTitle")} body={t("settings.igConnectedBody")}>
        <InfoCard vector="social" title={t("settings.igConnectedTitle")}>
          {t("settings.igConnectedCard")}
        </InfoCard>
        <Button variant="secondary" onClick={() => go("main")}>
          {t("settings.backSettings")}
        </Button>
      </StatusScreen>
    ) : (
      <StatusScreen title={t("settings.igTitle")} body={t("settings.igBody")}>
        <InfoCard vector="social" title={t("settings.igCardTitle")}>
          {t("settings.igCardBody")}
        </InfoCard>
        {igResult === "error" && (
          <p role="alert" className="text-sm text-danger">
            {t("settings.igError")}
          </p>
        )}
        <p className="text-[13px] text-muted">{t("settings.igHint")}</p>
        <AnchorButton href="/api/auth/instagram?next=settings">{t("settings.igConnect")}</AnchorButton>
        <Button variant="text" onClick={() => go("main")}>
          {t("settings.igSkip")}
        </Button>
      </StatusScreen>
    );
  }

  // Email reminders (228:15583)
  if (view === "reminders") {
    return (
      <StatusScreen title={t("settings.remindTitle")} body={t("settings.remindBody")}>
        {/* shortcut: no opt-out column for the ready-post email yet (FR-NT-01 always sends), so it shows On. */}
        <Field n={1} cue="text" label={t("settings.remindEmail")}>
          <input value={t("settings.remindOn")} readOnly className={glassInput} />
        </Field>
        <Field n={2} cue="clock" label={t("settings.remindTime")}>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={glassInput} />
        </Field>
        <Field n={3} cue="globe" label={t("settings.remindZone")}>
          <input value={zone} readOnly className={glassInput} />
        </Field>
        <InfoCard vector="clock" title={t("settings.remindCardTitle")}>
          {t("settings.remindCardBody")}
        </InfoCard>
        {error}
        <Button onClick={() => run(() => saveReminder({ notify_time: time }))} disabled={pending || !time} aria-busy={pending}>
          {t("settings.saveReminders")}
        </Button>
        {cancel}
      </StatusScreen>
    );
  }

  // Account and privacy (228:15680)
  if (view === "account") {
    return (
      <StatusScreen title={t("settings.accountTitle")} body={t("settings.accountBody")}>
        <Field n={1} cue="text" label={t("settings.email")}>
          <input value={email} readOnly className={glassInput} />
        </Field>
        <section className="glass flex flex-col gap-2 rounded-card p-5 leading-[1.4]">
          <h2 className="text-lg font-semibold">{t("settings.motion")}</h2>
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-medium">
            {t("settings.motionReduce")}
            <input type="checkbox" checked={reduceMotion} onChange={(e) => setMotion(e.target.checked)} className="size-5 shrink-0 accent-blue" />
          </label>
          <p className="text-[15px] text-muted">{t("settings.motionBody")}</p>
        </section>
        <InstallMarken />
        <p className="text-[13px] text-muted">{t("settings.installBody")}</p>
        <ButtonLink href="/onboarding/5" variant="secondary">
          {t("settings.tour")}
        </ButtonLink>
        <Button variant="text" className="text-danger!" onClick={() => go("delete")}>
          {t("settings.deleteAll")}
        </Button>
        <form action={signOut} className="flex flex-col">
          <Button type="submit" variant="text">
            {t("settings.signOut")}
          </Button>
        </form>
        <Button variant="text" onClick={() => go("main")}>
          {t("settings.backSettings")}
        </Button>
      </StatusScreen>
    );
  }

  // Settings menu (228:14906 / 228:15020): one list on mobile, two glass cards on desktop.
  return (
    <div className="flex flex-col gap-6 lg:gap-7">
      <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.title")} body={t("settings.body")} />
      <div className="grid items-start gap-3 lg:grid-cols-2 lg:gap-5">
        <Group title={t("settings.groupContent")} body={t("settings.groupContentBody")}>
          <Row icon="shop" n={1} onClick={() => go("shop")} />
          <Row icon="voice" n={2} onClick={() => go("brand")} />
          <Row icon="social" n={3} onClick={() => go("instagram")} />
        </Group>
        <Group
          title={t("settings.groupAccount")}
          body={t("settings.groupAccountBody")}
          after={
            <InfoCard vector="check" title={t("settings.approvalTitle")}>
              {t("settings.approvalBody")}
            </InfoCard>
          }
        >
          <Row icon="mail" n={4} onClick={() => go("reminders")} />
          <Row icon="plan" n={5} href="/onboarding/5" />
          <Row icon="check" n={6} onClick={() => go("account")} />
        </Group>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={glassInput}>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

// Group heading shows on desktop only; mobile is one continuous list (228:14906).
function Group({ title, body, children, after }: { title: string; body: string; children: ReactNode; after?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 lg:glass lg:rounded-2xl lg:p-6">
      <h2 className="text-lg font-semibold max-lg:hidden">{title}</h2>
      <p className="text-[15px] text-muted max-lg:hidden">{body}</p>
      <ul className="flex flex-col gap-3">{children}</ul>
      {after}
    </section>
  );
}

// Numbered illustrated row (Figma "Settings row").
function Row({ icon, n, onClick, href }: { icon: string; n: number; onClick?: () => void; href?: string }) {
  const cls = "glass flex min-h-16 w-full items-center gap-3 rounded-card px-4 py-3 text-left leading-[1.4] focus-visible:outline-2 focus-visible:outline-blue";
  const inner = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
      <img src={`/figma/row-${icon}.svg`} width={32} height={20.57} alt="" className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold whitespace-pre-wrap">{t(`settings.row${n}` as MessageKey)}</span>
        <span className="text-[13px] text-muted">{t(`settings.row${n}Body` as MessageKey)}</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
      <img src="/figma/row-chevron.svg" width={16} height={20} alt="" className="shrink-0" />
    </>
  );
  return (
    <li data-tour={`settings-${n}`}>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}
