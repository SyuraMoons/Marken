import type { ReactNode } from "react";

// Gradient intro card at the top of each main tab (Figma "Signature header"); the decoration shows on desktop only.
export function PageHeader({ eyebrow, title, body, eyebrowDesktop = false, children }: { eyebrow: string; title: string; body: string; eyebrowDesktop?: boolean; children?: ReactNode }) {
  return (
    <header className="bg-signature relative flex flex-col gap-2.5 overflow-hidden rounded-[18px] border border-white/85 px-4 py-6 leading-[1.4] shadow-[0_6px_11px_rgb(31_59_122/6%)] lg:rounded-card lg:px-6 lg:py-7">
      <p className={`text-[10px] font-semibold text-blue uppercase lg:text-[11px] ${eyebrowDesktop ? "" : "lg:hidden"}`}>{eyebrow}</p>
      <h1 className="text-[28px] font-semibold lg:text-4xl lg:leading-[1.2]">{title}</h1>
      <p className="text-muted lg:text-[15px]">{body}</p>
      {children}
      {/* eslint-disable-next-line @next/next/no-img-element -- static design decoration */}
      <img src="/figma/header-spark.svg" width={230} height={160} alt="" className="absolute top-0 right-0 hidden lg:block" />
    </header>
  );
}
