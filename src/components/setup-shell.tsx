import type { ReactNode } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { ButtonLink } from "./button";
import { Logo } from "./logo";
import { SaveAndExit } from "./save-and-exit";

export const SETUP_STEPS = 5;

// Onboarding frame: eyebrow + 5-segment bar + Back (DX-08, DX-29).
export function SetupShell({ step, shopId, children }: { step: number; shopId: string; children: ReactNode }) {
  const name = t(`setup.step${step}` as MessageKey);
  return (
    <div className="bg-atmosphere flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-6">
        <header className="flex h-10 items-center">
          <Logo />
        </header>

        <p className="mt-6 text-xs font-medium tracking-wide text-blue uppercase">
          {t("setup.stepOf", { n: step, total: SETUP_STEPS })} / {name}
        </p>
        <ol className="mt-2 grid grid-cols-5 gap-1.5" aria-label={t("setup.stepOf", { n: step, total: SETUP_STEPS })}>
          {Array.from({ length: SETUP_STEPS }, (_, i) => (
            <li key={i} className={`h-1 rounded-full ${i < step ? "bg-blue" : "bg-border"}`} />
          ))}
        </ol>

        <div className="mt-2 flex min-h-11 items-start justify-between gap-3">
          {step > 1 ? (
            <ButtonLink href={`/onboarding/${step - 1}`} variant="text" className="w-auto! px-0">
              {t("setup.back")}
            </ButtonLink>
          ) : (
            <span />
          )}
          <SaveAndExit shopId={shopId} step={step} />
        </div>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
