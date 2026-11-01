import Link from "next/link";
import type { ComponentProps } from "react";

// Button rules: docs/frontend/DESIGN_FIXES.md (DX-25..28).
const VARIANTS = {
  primary: "h-13 bg-blue text-white shadow-[0_8px_20px_-8px_var(--color-blue)] hover:brightness-110",
  secondary: "h-13 border border-border bg-surface text-ink hover:bg-powder/40",
  text: "h-11 text-blue hover:underline",
  danger: "h-13 bg-danger text-white hover:brightness-110",
} as const;

type Variant = keyof typeof VARIANTS;

const base =
  "inline-flex w-full items-center justify-center rounded-control px-4 text-base font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}
