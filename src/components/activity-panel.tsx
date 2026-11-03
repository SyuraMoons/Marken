import type { Tables } from "@/lib/supabase/database.types";
import { hasKey, t, type MessageKey } from "@/lib/i18n";

type Call = Pick<Tables<"model_calls">, "step" | "latency_ms" | "cost_usd" | "cache_hit" | "fallback">;

export const stepLabel = (s: string) => {
  const key = `step.${s}`;
  return hasKey(key) ? t(key) : s;
};
const usd = (n: number) => `$${n.toFixed(3)}`;

const DOT: Record<string, string> = {
  succeeded: "bg-blue",
  running: "bg-powder animate-pulse",
  failed: "bg-danger",
  skipped: "bg-border",
};

// Agent activity per post (F-24, FR-AP-01, FR-CL-02). Native <details>, no JS.
export function ActivityPanel({ steps, calls, open }: { steps: Tables<"post_steps">[]; calls: Call[]; open?: boolean }) {
  const total = calls.reduce((sum, c) => sum + Number(c.cost_usd), 0);
  const cached = calls.filter((c) => c.cache_hit).reduce((sum, c) => sum + Number(c.cost_usd), 0);

  return (
    <details open={open} className="group rounded-card border border-border bg-white">
      <summary className="flex h-13 cursor-pointer list-none items-center justify-between px-5 font-medium text-blue">
        {t("today.activity")}
        <span aria-hidden="true" className="text-sm transition group-open:rotate-180">▾</span>
      </summary>
      {steps.length === 0 && <p role="status" className="px-5 py-4 text-sm text-muted">{t("activity.empty")}</p>}
      <ol className="flex flex-col divide-y divide-border px-5">
        {steps.map((s) => {
          const mine = calls.filter((c) => c.step === s.step);
          const ms = mine.reduce((sum, c) => sum + c.latency_ms, 0);
          const cost = mine.reduce((sum, c) => sum + Number(c.cost_usd), 0);
          return (
            <li key={s.id} className="flex items-start gap-3 py-3">
              <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT[s.status] ?? "bg-border"}`} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{stepLabel(s.step)}</span>
                <span className="text-sm text-muted">
                  {[s.model ?? t("activity.code"), t(`activity.${s.status}` as MessageKey), ms ? `${(ms / 1000).toFixed(1)} s` : null, cost ? usd(cost) : null]
                    .filter(Boolean)
                    .join(" · ")}
                  {mine.some((c) => c.fallback) && ` · ${t("activity.fallback")}`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="border-t border-border px-5 py-3 text-sm text-muted">
        {t("activity.total", { cost: usd(total), cache: total ? Math.round((cached / total) * 100) : 0 })}
      </p>
    </details>
  );
}
