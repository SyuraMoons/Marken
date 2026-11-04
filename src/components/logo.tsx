import Link from "next/link";

const TONES = { navy: "text-navy", white: "text-white", ink: "text-ink" } as const;

// Wordmark "marken ✦" with blue/pink offset accents (2 Nov design); one accessible name.
export function Logo({ href = "/", tone = "navy", className = "text-2xl" }: { href?: string; tone?: keyof typeof TONES; className?: string }) {
  return (
    <Link href={href} className={`wordmark inline-flex min-h-11 items-center gap-[0.3em] leading-[1.4] font-bold ${TONES[tone]} ${className}`} aria-label="Marken home">
      marken<span aria-hidden="true">✦</span>
    </Link>
  );
}
