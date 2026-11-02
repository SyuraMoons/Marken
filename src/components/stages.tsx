import { t, type MessageKey } from "@/lib/i18n";

export const STAGES = [
  ["research", "activity.s1"],
  ["score", "activity.s2"],
  ["plan", "activity.s3"],
  ["build", "activity.s4"],
  ["check", "activity.s5"],
] as const;

// One illustrated activity stage (228:10170).
export function Stage({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="glass flex items-center gap-3.5 rounded-card p-5 leading-[1.4]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
      <img src={`/figma/step-${icon}.svg`} width={72} height={46} alt="" className="shrink-0" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="text-lg font-semibold whitespace-pre-wrap">{title}</h2>
        <p className="text-[15px] text-muted">{body}</p>
      </div>
    </div>
  );
}

// The five plain-language creation stages shown on Today's activity view and in the tour.
export function Stages() {
  return STAGES.map(([icon, key]) => <Stage key={key} icon={icon} title={t(key)} body={t(`${key}Body` as MessageKey)} />);
}
