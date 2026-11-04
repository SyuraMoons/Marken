"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const MAX_DELAY_MS = 15_000;

// shortcut: re-reads the page while a job runs (FD-12), swap for Supabase Realtime if it lags.
// The next refresh is scheduled only after the previous one has rendered, backs off over time,
// pauses in hidden tabs, and stops after `maxMs` so a stuck job (e.g. Inngest not running) never polls forever.
export function AutoRefresh({ ms = 3000, maxMs = 10 * 60_000 }: { ms?: number; maxMs?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tick, setTick] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    startedAt.current ??= Date.now();
    if (pending || Date.now() - startedAt.current > maxMs) return;
    const delay = Math.min(ms * 1.25 ** tick, MAX_DELAY_MS);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (document.hidden) return;
      start(() => router.refresh());
      setTick((n) => n + 1);
    };
    const onVisible = () => {
      if (!document.hidden) run();
    };
    timer = setTimeout(() => {
      timer = undefined;
      if (document.hidden) document.addEventListener("visibilitychange", onVisible, { once: true });
      else run();
    }, delay);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pending, tick, ms, maxMs, router]);

  return null;
}
