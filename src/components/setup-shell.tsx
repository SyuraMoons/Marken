import Link from "next/link";
import type { ReactNode } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { ButtonLink } from "./button";
import { Logo } from "./logo";
import { SaveAndExit } from "./save-and-exit";

export const SETUP_STEPS = 5;

// The two step illustrations per step (Figma "Illustrated setup step").
const CUES: Record<number, [string, string]> = { 1: ["shop", "product"], 2: ["camera", "product"], 3: ["product", "check"], 4: ["voice", "rules"], 5: ["post", "check"] };

const name = (n: number) => t(`setup.step${n}` as MessageKey);

// Onboarding frame (Figma page 05 setup-*): eyebrow, 5-part bar, Back / Save and exit; navy step list on desktop.
export function SetupShell({ step, shopId, shopName, children }: { step: number; shopId: string; shopName: string; children: ReactNode }) {
  return (
    <div className="bg-app flex min-h-dvh">
      <aside className="flex w-56 shrink-0 flex-col gap-6 bg-navy px-6 pt-8 pb-4 leading-[1.4] text-white max-lg:hidden">
        <Logo tone="white" />
        <p className="text-xl font-semibold">{t("setup.title")}</p>
        <ol className="flex flex-col gap-6 text-[15px]">
          {Array.from({ length: SETUP_STEPS }, (_, i) => i + 1).map((n) => (
            <li key={n} aria-current={n === step ? "step" : undefined} className={n === step ? "font-semibold" : ""}>
              {n < step ? (
                <Link href={`/onboarding/${n}`} className="flex min-h-11 items-center hover:underline focus-visible:outline-2 focus-visible:outline-white">
                  ✓ {t(`setup.done${n}` as MessageKey)}
                </Link>
              ) : (
                `${n}. ${name(n)}`
              )}
            </li>
          ))}
        </ol>
        <p className="text-[13px]">{t("setup.required")}</p>
        <SaveAndExit shopId={shopId} step={step} className="text-white!" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[74px] items-start gap-6 p-5 leading-[1.4] lg:glass lg:h-auto lg:items-center lg:px-10 lg:py-[22px] lg:text-[13px]">
          <span className="lg:hidden">
            <Logo />
          </span>
          <p className="ml-auto text-xs font-medium text-muted lg:ml-0 lg:text-[13px] lg:font-normal">
            <span className="lg:hidden">{t("setup.tag")}</span>
            <span className="max-lg:hidden">{t("setup.bar")}</span>
          </p>
          {shopName && <p className="font-medium max-lg:hidden lg:ml-auto">{shopName}</p>}
        </header>

        <main className="flex flex-col gap-5 px-5 pt-6 pb-8 leading-[1.4] lg:gap-7 lg:px-10 lg:pt-10 lg:pb-12">
          <p className="text-[13px] font-semibold whitespace-pre-wrap text-blue">{t("setup.stepOf", { n: step, total: SETUP_STEPS, name: name(step) })}</p>
          <ol className="flex gap-1.5" aria-label={t("setup.progress", { n: step, total: SETUP_STEPS })}>
            {Array.from({ length: SETUP_STEPS }, (_, i) => (
              <li key={i} className={`h-[5px] flex-1 rounded-[3px] ${i < step ? "bg-blue" : "bg-border"}`} />
            ))}
          </ol>
          <div className="flex gap-2.5 lg:hidden">
            {step > 1 ? (
              <ButtonLink href={`/onboarding/${step - 1}`} variant="text" className="h-12 flex-1">
                {t("setup.back")}
              </ButtonLink>
            ) : (
              <span className="flex-1" />
            )}
            <SaveAndExit shopId={shopId} step={step} className="h-12 flex-[1.27]" />
          </div>
          <div className="flex items-center gap-3.5" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
            <img src={`/figma/setup-${CUES[step][0]}.svg`} width={64} height={64} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
            <img src="/figma/setup-arrow.svg" width={34} height={24} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
            <img src={`/figma/setup-${CUES[step][1]}.svg`} width={64} height={64} alt="" />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
