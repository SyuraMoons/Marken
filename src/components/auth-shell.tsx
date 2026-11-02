import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Logo } from "./logo";

// Sign-in frame (FD-23): one column on mobile; 400 px navy panel + glass header on desktop.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-app flex min-h-dvh">
      <aside className="sticky top-0 flex h-dvh w-100 shrink-0 flex-col justify-center gap-5 bg-navy px-10 py-12 leading-[1.4] text-white max-lg:hidden">
        <h2 className="text-[44px] font-semibold">{t("login.panelTitle")}</h2>
        <p className="text-lg">{t("login.panelBody")}</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start gap-6 p-5 leading-[1.4] lg:glass lg:items-center lg:p-8">
          <Logo className="text-2xl lg:text-[26px] lg:font-semibold!" />
          <p className="ml-auto text-xs font-medium text-muted lg:ml-0 lg:text-sm lg:font-normal">
            <span className="lg:hidden">{t("login.tag")}</span>
            <span className="max-lg:hidden">{t("login.tagLg")}</span>
          </p>
        </header>
        <main className="flex justify-center px-5 pt-6 pb-8 lg:p-12">
          <section className="flex w-full max-w-xl flex-col gap-5 leading-[1.4] lg:glass lg:max-w-184 lg:gap-4 lg:rounded-2xl lg:p-6">{children}</section>
        </main>
      </div>
    </div>
  );
}
