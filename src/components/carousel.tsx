"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Slide } from "@/lib/posts/slides";

// 4:5 slides, CSS scroll-snap swipe (FD-10), labels jump to a slide (DX-33).
export function Carousel({ slides, labels }: { slides: Slide[]; labels: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const go = (i: number) => {
    const el = track.current;
    // Static jump under reduced motion (DESIGN §6).
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: still ? "auto" : "smooth" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={track}
        onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-card [scrollbar-width:none]"
        aria-roledescription="carousel"
      >
        {slides.map((s, i) => (
          <div key={s.order} className="relative aspect-[4/5] w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
            <Image src={s.slide_path} alt={s.alt} fill sizes="(min-width: 1024px) 480px, 100vw" className="object-cover" priority={i === 0} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => go(i)}
            aria-current={i === current ? "true" : undefined}
            className={`h-11 text-sm font-medium ${i === current ? "text-blue" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
