"use client";

import { useEffect, useRef, useState } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { Sprite } from "./sprite";

const CATS = [0, 1, 2] as const;
const DELAY = 2000;

function Panel({ cat, big, side }: { cat: number; big?: boolean; side?: "left" | "right" }) {
  const position = big ? "hero-panel-center" : side === "left" ? "hero-panel-left" : "hero-panel-right";
  return (
    <div
      aria-hidden={!big}
      className={`hero-panel ${position} overflow-hidden rounded-md border border-powder bg-white shadow-xl`}
    >
      <Sprite
        src="/figma/landing-products.png"
        i={cat}
        crop="lg:h-[540%] lg:top-[-220%]"
        alt={big ? t("landing.slide", { name: t(`landing.cat${cat}` as MessageKey) }) : ""}
        sizes={big ? "(min-width: 1024px) 1944px, 630px" : "(min-width: 1024px) 972px, 180px"}
        priority={big}
      />
    </div>
  );
}

// Hero product slider (228:16197, 245:2147..4464): 3 example states, autoplay, swipe and keyboard controls.
export function LandingHero() {
  const [active, setActive] = useState(1);
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const playing = visible;
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
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
    >
      <div
        aria-live={playing ? "off" : "polite"}
        className="hero-panel-track relative min-h-[270px] w-full touch-pan-y lg:min-h-90 lg:max-w-336"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
          touchX.current = null;
        }}
      >
        {CATS.map((cat) => <Panel key={cat} cat={cat} big={cat === active} side={cat === (active + 2) % 3 ? "left" : "right"} />) }
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

    </div>
  );
}
