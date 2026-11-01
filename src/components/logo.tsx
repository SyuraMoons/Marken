import Link from "next/link";

// Wordmark "marken ✦" (DX-31).
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="text-2xl font-semibold tracking-tight text-ink" aria-label="Marken home">
      marken <span aria-hidden="true">✦</span>
    </Link>
  );
}
