import type { ReactNode } from "react";

// Glass input used by every 2 Nov form (Figma "Section / ..." value boxes).
export const glassInput =
  "glass w-full rounded-card p-3.5 text-base leading-[1.4] font-normal text-ink placeholder:text-muted focus:outline-2 focus:outline-blue";

export type Cue = "clock" | "globe" | "product" | "rules" | "shop" | "tag" | "text" | "voice";

// Numbered label with a small icon, then the control (Figma "Vector field label").
export function Field({ n, cue, label, children }: { n: number; cue: Cue; label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-4">
      <span className="flex items-center gap-2 text-sm leading-[1.4] font-medium whitespace-pre-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element -- static design icon */}
        <img src={`/figma/cue-${cue}.svg`} width={22} height={22} alt="" />
        {`${String(n).padStart(2, "0")}  ${label}`}
      </span>
      {children}
    </label>
  );
}
