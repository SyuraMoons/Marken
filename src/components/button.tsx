import { NavigationLoading } from "./navigation-loading";
import Link from "next/link";
import type { ComponentProps } from "react";

// Button rules: docs/frontend/DESIGN_FIXES.md (DX-25..28).
const VARIANTS = {
  primary: "h-13 border border-blue bg-blue font-medium text-white hover:brightness-110",
  secondary: "h-13 border border-border bg-surface font-medium text-slate hover:bg-powder/40",
  text: "h-11 text-sm font-normal text-link hover:underline",
  danger: "h-13 bg-danger font-medium text-white hover:brightness-110",
} as const;

type Variant = keyof typeof VARIANTS;

const base =
  "inline-flex w-full items-center justify-center rounded-control px-3 text-base transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:opacity-50";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", children, showLoading = false, ...props }: ComponentProps<typeof Link> & { variant?: Variant; showLoading?: boolean }) {
  return <Link className={`${base} ${VARIANTS[variant]} ${className}`} {...props}>{children}{showLoading && <NavigationLoading />}</Link>;
}

// Plain anchor for server redirects (e.g. Instagram OAuth): Link would prefetch and client-navigate them.
export function AnchorButton({ variant = "primary", className = "", ...props }: ComponentProps<"a"> & { variant?: Variant }) {
  return <a className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}
