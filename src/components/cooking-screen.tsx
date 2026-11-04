import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

function Star({ className }: { className: string }) {
  return <svg aria-hidden="true" viewBox="86 28 104 104" className={className}><path d="M138 28C138 62 120 80 86 80C120 80 138 98 138 132C138 98 156 80 190 80C156 80 138 62 138 28Z" fill="currentColor" /></svg>;
}

export function CookingContent({ detail, children }: { detail?: string; children?: ReactNode }) {
  return <div className="flex w-full max-w-lg flex-col items-center gap-7 text-center">
    <div aria-hidden="true" className="cooking-art">
      <Star className="cooking-star cooking-star-center text-blue" />
      <div className="cooking-orbit">
        <Star className="cooking-star cooking-star-top text-blue" />
        <Star className="cooking-star cooking-star-left text-link" />
        <Star className="cooking-star cooking-star-right text-pink" />
      </div>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col items-center gap-3">
      <p className="text-2xl font-semibold text-ink lg:text-[28px]">{t("loading.cooking")}</p>
      {detail && <p className="max-w-sm text-sm leading-6 text-muted">{detail}</p>}
    </div>
    {children}
  </div>;
}

export function CookingScreen(props: { detail?: string; children?: ReactNode }) {
  return <div className="bg-app cooking-screen"><CookingContent {...props} /></div>;
}

