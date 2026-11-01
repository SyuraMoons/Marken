"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "./button";
import { InstallMarken } from "./install-marken";
import { ListRow } from "./list-row";
import { StatusScreen } from "./status-screen";
import { t, type MessageKey } from "@/lib/i18n";
import { mockShop, mockUser } from "@/lib/mock";

const input = "h-13 w-full rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue";
const label = "flex flex-col gap-1.5 text-sm font-medium";
const TONES = ["Warm", "Playful", "Elegant", "Casual"] as const;

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

// Settings and sub-views (F-15, DX-06, DX-27). Mock state until settings writes land.
export function SettingsView() {
  const [view, setView] = useState<View>("main");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Warm");
  const [rules, setRules] = useState<string[]>(["Never show prices"]);
  const [draft, setDraft] = useState("");
  const [ig, setIg] = useState(true);
  const reduceMotion = useSyncExternalStore(subscribeMotion, readMotion, () => false);
  const igName = "rani.studio";

  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduce" : "";
  }, [reduceMotion]);

  const head = (key: string) => <h1 className="text-3xl font-semibold tracking-tight">{t(key as MessageKey)}</h1>;
  const back = (
    <Button variant="text" className="w-auto! self-start px-0" onClick={() => setView("main")}>
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
        <p className="text-muted">{t("settings.deleteBody", { name: mockShop.name ?? "" })}</p>
        <Button variant="danger" onClick={() => setView("deleted")}>
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
              <input defaultValue={mockShop.name ?? ""} className={input} />
            </label>
            <label className={label}>
              {t("settings.category")}
              <select defaultValue="Beauty" className={input}>
                {["Food & drinks", "Fashion", "Beauty", "Crafts", "Home", "Other"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("settings.country")}
              <select defaultValue="Indonesia" className={input}>
                {["Indonesia", "Malaysia", "Singapore", "Philippines", "Thailand", "Other"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              {t("settings.timezone")}
              <select defaultValue="Asia/Jakarta" className={input}>
                {["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur"].map((z) => (
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
            {ig ? (
              <>
                <p className="flex min-h-11 items-center gap-2 font-medium text-blue">
                  <span aria-hidden="true">✓</span> {t("settings.connected", { name: igName })}
                </p>
                <Button variant="text" className="w-auto! self-start px-0 text-danger!" onClick={() => setIg(false)}>
                  {t("settings.disconnect")}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setIg(true)}>
                {t("settings.connect")}
              </Button>
            )}
          </div>
        )}

        {view === "reminders" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <p className="text-muted">{t("settings.remindBody")}</p>
            <label className="flex min-h-13 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
              {t("settings.remindOn")}
              <input type="checkbox" defaultChecked className="size-5 accent-blue" />
            </label>
            <label className={label}>
              {t("settings.remindTime")}
              <input type="time" defaultValue="08:00" className={input} />
            </label>
          </div>
        )}

        {view === "account" && (
          <div className="flex flex-col gap-4 rounded-card border border-border bg-white p-5">
            <label className={label}>
              {t("settings.email")}
              <input value={mockUser.email ?? ""} readOnly className={`${input} bg-surface!`} />
            </label>
            <div className="flex flex-col gap-1.5">
              <label className="flex min-h-13 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                {t("settings.motion")}
                <input type="checkbox" aria-label={t("settings.motionReduce")} checked={reduceMotion} onChange={(e) => setMotion(e.target.checked)} className="size-5 shrink-0 accent-blue" />
              </label>
              <p className="text-sm text-muted">{t("settings.motionBody")}</p>
            </div>
            <InstallMarken />
            <Button variant="secondary">{t("settings.signOut")}</Button>
          </div>
        )}

        {view !== "account" && view !== "instagram" && <Button onClick={() => setView("main")}>{t("settings.save")}</Button>}
      </section>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="pt-2 text-4xl font-semibold tracking-tight">{t("settings.title")}</h1>
      <section className="divide-y divide-border rounded-card border border-border bg-white">
        <ListRow label={t("settings.shop")} value={mockShop.name ?? ""} onClick={() => setView("shop")} />
        <ListRow label={t("settings.brand")} value={t("settings.rulesValue", { tone: t(`ob4.tone${tone}` as MessageKey), n: rules.length })} onClick={() => setView("brand")} />
        <ListRow label={t("settings.instagram")} value={ig ? t("settings.connected", { name: igName }) : t("settings.notConnected")} onClick={() => setView("instagram")} />
        <ListRow label={t("settings.reminders")} value="08:00" onClick={() => setView("reminders")} />
        <ListRow label={t("settings.account")} value={mockUser.email ?? ""} onClick={() => setView("account")} />
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
