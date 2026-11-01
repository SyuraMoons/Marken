"use client";

import Image from "next/image";
import { useState } from "react";
import type { Slide } from "@/lib/posts/slides";

type Labels = { badge: string; before: string; after: string };

// "Real product" badge + before/after toggle (FR-FD-03). Parent renders it only when every slide passed.
export function ProductCheck({ photo, slide, labels }: { photo: { src: string; name: string }; slide: Slide; labels: Labels }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-control border border-border bg-surface font-medium text-ink"
      >
        <span aria-hidden="true" className="text-blue">✓</span>
        {labels.badge}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { src: photo.src, alt: `${photo.name}, your original photo`, label: labels.before },
            { src: slide.slide_path, alt: slide.alt, label: labels.after },
          ].map((x) => (
            <figure key={x.label} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/5] overflow-hidden rounded-control bg-white">
                <Image src={x.src} alt={x.alt} fill sizes="240px" className="object-cover" />
              </div>
              <figcaption className="text-center text-xs font-medium text-muted">{x.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
