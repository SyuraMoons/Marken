"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { Sprite } from "./sprite";

const CATS = [0, 1, 2] as const;
const DELAY = 3200; // FD-25

// Off when the OS or the Settings switch asks for reduced motion.
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  window.addEventListener("marken-motion", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("marken-motion", cb);
  };
};
const reduced = () => document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Panel({ cat, big, side }: { cat: number; big?: boolean; side?: "left" | "right" }) {
  const tilt = side === "left" ? "rotate-2 skew-x-[-3.14deg] lg:skew-x-[7.15deg]" : side === "right" ? "-rotate-2 skew-x-[3.14deg] lg:skew-x-[-7.15deg]" : "skew-x-[-1.43deg] lg:skew-x-0";
  // Desktop sizes are fractions of the track so 1024–1440 px never overflows; ratios match the 1440 frame.
  const size = big
    ? "size-[210px] max-[389px]:size-[180px] lg:aspect-[648/240] lg:h-auto lg:w-[47%] lg:max-w-162"
    : "h-[150px] w-[60px] opacity-80 lg:aspect-[324/185] lg:h-auto lg:w-[23%] lg:max-w-81 lg:opacity-100";
  const crop = big ? "lg:h-[540%] lg:top-[-220%]" : "lg:h-[350.27%] lg:top-[-125.14%]";
  return (
    <div
      aria-hidden={!big}
      className={`relative shrink-0 overflow-hidden rounded-md bg-white drop-shadow-[0_18px_14px_rgb(3_8_36/32%)] ${big ? "border-2 border-[#80a6f2]" : "border border-[#d9e5fa]"} ${tilt} ${size}`}
    >
      <Sprite
        src="/figma/landing-products.png"
        i={cat}
        crop={crop}
        alt={big ? t("landing.slide", { name: t(`landing.cat${cat}` as MessageKey) }) : ""}
        sizes={big ? "(min-width: 1024px) 1944px, 630px" : "(min-width: 1024px) 972px, 180px"}
        priority={big}
      />
    </div>
  );
}

// Hero product slider (228:16197, 245:2147..4464): 3 example states, autoplay, swipe, keys, pause.
export function LandingHero() {
  const [active, setActive] = useState(1);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false); // hover or focus inside
  const [visible, setVisible] = useState(true);
  const still = useSyncExternalStore(subscribe, reduced, () => true);
  const root = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const playing = !still && !paused && !held && visible;
  const go = (n: number) => setActive((n + 3) % 3);

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % 3), DELAY);
    return () => clearTimeout(id);
  }, [playing, active]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("landing.slides")}
      className="flex w-full flex-col items-center gap-6 lg:gap-7"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHeld(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
    >
      <div
        aria-live={playing ? "off" : "polite"}
        className="flex min-h-[250px] w-full touch-pan-y items-center justify-center gap-2.5 py-6 lg:min-h-90 lg:max-w-336 lg:gap-6"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        <Panel cat={(active + 2) % 3} side="left" />
        <Panel cat={active} big />
        <Panel cat={(active + 1) % 3} side="right" />
      </div>
      <div className="flex w-full max-w-[350px] gap-2 lg:max-w-125">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={c === active}
            onClick={() => go(c)}
            className={`min-h-11 flex-1 rounded-3xl px-2.5 text-[11px] leading-[1.4] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:text-[13px] ${c === active ? "bg-blue text-white" : "bg-white text-[#142140]"}`}
          >
            {t(`landing.cat${c}` as MessageKey)}
          </button>
        ))}
      </div>
      {!still && (
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          className="min-h-11 rounded-2xl px-2 text-xs leading-[1.4] font-semibold text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          {t(paused ? "landing.play" : "landing.pause")}
        </button>
      )}
    </div>
  );
}
