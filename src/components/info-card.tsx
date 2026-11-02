import type { ReactNode } from "react";

export type Vector = "build" | "check" | "clock" | "details" | "heart" | "orders" | "photo" | "plan" | "research" | "score" | "social" | "voice";

// Glass card with a small illustration, heading and text (Figma "Section / ..." cards).
export function InfoCard({ vector, title, children }: { vector: Vector; title: string; children?: ReactNode }) {
  return (
    <section className="glass flex flex-col gap-3 rounded-card p-5 leading-[1.4]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
      <img src={`/figma/vector-${vector}.svg`} width={78} height={50} alt="" />
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="text-[15px] text-muted">{children}</div>}
    </section>
  );
}
