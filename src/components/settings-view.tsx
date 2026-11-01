"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { signOut } from "@/app/login/actions";
import { saveBrand, saveReminder, saveShop } from "@/app/(app)/settings/actions";
import { AnchorButton, Button, ButtonLink } from "./button";
import { InstallMarken } from "./install-marken";
import { ListRow } from "./list-row";
import { StatusScreen } from "./status-screen";
import { t, type MessageKey } from "@/lib/i18n";
import { asTone, CATEGORIES, COUNTRIES, TIME_ZONES, TONES, type Tone } from "@/lib/options";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";

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

type Props = {
  email: string;
  igConnected: boolean;
  rules: string[];
  shop: { id: string; name: string; category: string; country: string; time_zone: string; tone: string | null; notify_time: string };
};

// Settings and sub-views (F-15, DX-06, DX-27). Saves go through owner-scoped server actions.
export function SettingsView({ email, igConnected, rules: savedRules, shop }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const igResult = useSearchParams().get("ig");
  const [view, setView] = useState<View>(igResult ? "instagram" : "main");
  const [name, setName] = useState(shop.name);
  const [category, setCategory] = useState(shop.category);
  const [country, setCountry] = useState(shop.country);
  const [zone, setZone] = useState(shop.time_zone);
  const [tone, setTone] = useState<Tone>(asTone(shop.tone));
  const [rules, setRules] = useState<string[]>(savedRules);
  const [draft, setDraft] = useState("");
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, () => false);
  const [time, setTime] = useState(shop.notify_time);

  const run = (job: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setFailed(false);
      const res = await job().catch(() => ({ ok: false }));
      if (!res.ok) return setFailed(true);
      router.refresh();
      setView("main");
    });

  const save = () => {
    if (view === "shop") return run(() => saveShop({ name, category, country, time_zone: zone }));
    if (view === "brand") return run(() => saveBrand({ tone, rules }));
    return run(() => saveReminder({ notify_time: time }));
  };

  const remove = () =>
    start(async () => {
      setFailed(false);
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }).catch(() => null);
      if (!res?.ok) return setFailed(true);
      setView("deleted");
    });

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduce" : "full";
  }, [reduceMotion]);

  const head = (key: string) => <h1 className="text-3xl font-semibold tracking-tight">{t(key as MessageKey)}</h1>;
  const back = (
    <Button variant="text" className="w-auto! self-start px-0" onClick={() => { setFailed(false); setView("main"); }}>
      ← {t("settings.back")}
    </Button>
  );

  if (view === "deleted") {
    return (
      <StatusScreen icon="✓" title={t("settings.deletedTitle")} body={t("settings.deletedBody")}>
        <ButtonLink href="/">{t("settings.startAgain")}</ButtonLink>
      </StatusScreen>
    );
  }

  if (view === "delete") {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        {back}
        {head("settings.deleteTitle")}
        <p className="text-muted">{t("settings.deleteBody", { name: shop.name })}</p>
        {failed && (
          <p role="alert" className="text-sm text-danger">
            {t("common.error")}
          </p>
        )}
        <Button variant="danger" onClick={remove} disabled={pending} aria-busy={pending}>
          {t("settings.deleteConfirm")}
        </Button>
        <Button variant="text" onClick={() => setView("main")}>
          {t("settings.cancel")}
        </Button>
      </section>
    );
  }

  if (view === "shop" || view === "brand" || view === "instagram" || view === "reminders" || view === "account") {
    return (
      <section className="flex max-w-xl flex-col gap-5">
        {back}
        {head(`settings.${view}`)}

        {view === "shop" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <label className={label}>
              {t("settings.name")}
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </label>
            <label className={label}>
              {t("settings.category")}
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {[...new Set([category, ...CATEGORIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("settings.country")}
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={input}>
                {[...new Set([country, ...COUNTRIES])].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("settings.timezone")}
              <select value={zone} onChange={(e) => setZone(e.target.value)} className={input}>
                {[...new Set([zone, ...TIME_ZONES])].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
          </div>
        )}

        {view === "brand" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium">{t("settings.tone")}</legend>
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
              <label className="text-sm font-medium" htmlFor="s-rule">
                {t("settings.rules")}
              </label>
              <ul className="flex flex-col gap-1.5">
                {rules.map((r) => (
                  <li key={r} className="flex min-h-11 items-center justify-between gap-2 rounded-control bg-surface px-3 text-sm">
                    <span>{r}</span>
                    <button type="button" aria-label={t("settings.removeRule", { rule: r })} onClick={() => setRules(rules.filter((x) => x !== r))} className="flex size-11 shrink-0 items-center justify-center text-danger">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input id="s-rule" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} placeholder={t("settings.rulePlaceholder")} className={input} />
                <Button
                  variant="secondary"
                  className="w-auto! shrink-0 px-4"
                  onClick={() => {
                    if (draft.trim() && rules.length < 10) setRules([...rules, draft.trim()]);
                    setDraft("");
                  }}
                  disabled={!draft.trim() || rules.length >= 10}
                >
                  {t("settings.addRule")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {view === "instagram" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <p className="text-muted">{t("settings.igBody")}</p>
            {igConnected ? (
              <p className="flex min-h-11 items-center gap-2 font-medium text-blue">
                <span aria-hidden="true">✓</span> {t("settings.connected", { name: t("settings.instagram") })}
              </p>
            ) : (
              <>
                {igResult === "error" && (
                  <p role="alert" className="text-sm text-danger">
                    {t("settings.igError")}
                  </p>
                )}
                <p className="text-sm text-muted">{t("settings.igHint")}</p>
                <AnchorButton href="/api/auth/instagram?next=settings">{t("settings.igConnect")}</AnchorButton>
              </>
            )}
          </div>
        )}

        {view === "reminders" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <p className="text-muted">{t("settings.remindBody")}</p>
            <label className={label}>
              {t("settings.remindTime")}
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={input} />
            </label>
          </div>
        )}

        {view === "account" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <label className={label}>
              {t("settings.email")}
              <input value={email} readOnly className={`${input} bg-surface!`} />
            </label>
            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-13 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                {t("settings.motion")}
                <input type="checkbox" aria-label={t("settings.motionReduce")} checked={reduceMotion} onChange={(e) => setMotion(e.target.checked)} className="size-5 shrink-0 accent-blue" />
              </label>
              <p className="text-sm text-muted">{t("settings.motionBody")}</p>
            </div>
            <InstallMarken />
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                {t("settings.signOut")}
              </Button>
            </form>
          </div>
        )}

        {failed && (
          <p role="alert" className="text-sm text-danger">
            {t("common.error")}
          </p>
        )}
        {view !== "account" && view !== "instagram" && (
          <Button onClick={save} disabled={pending || (view === "shop" && !name.trim())} aria-busy={pending}>
            {t("settings.save")}
          </Button>
        )}
      </section>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="pt-2 text-4xl font-semibold tracking-tight">{t("settings.title")}</h1>
      <section className="divide-y divide-border rounded-card border border-border bg-white">
        <ListRow label={t("settings.shop")} value={name} onClick={() => setView("shop")} />
        <ListRow label={t("settings.brand")} value={t("settings.rulesValue", { tone: t(`ob4.tone${tone}` as MessageKey), n: rules.length })} onClick={() => setView("brand")} />
        <ListRow label={t("settings.instagram")} value={igConnected ? t("settings.connected", { name: t("settings.instagram") }) : t("settings.notConnected")} onClick={() => setView("instagram")} />
        <ListRow label={t("settings.reminders")} value={time} onClick={() => setView("reminders")} />
        <ListRow label={t("settings.account")} value={email} onClick={() => setView("account")} />
      </section>
      <ButtonLink href="/onboarding/5" variant="text" className="w-auto! self-start px-0">
        {t("settings.tour")}
      </ButtonLink>
      <section className="rounded-card border border-border bg-white">
        <ListRow label={t("settings.delete")} danger onClick={() => setView("delete")} />
      </section>
    </div>
  );
}
