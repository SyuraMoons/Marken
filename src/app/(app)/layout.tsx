import Link from "next/link";
import { t } from "@/lib/i18n";

const NAV = [
  { href: "/today", label: t("nav.today") },
  { href: "/products", label: t("nav.products") },
  { href: "/results", label: t("nav.results") },
  { href: "/settings", label: t("nav.settings") },
];

// Main app shell. Auth guard comes with Supabase Auth (FR-AU-04).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      <nav className="sticky bottom-0 grid grid-cols-4 border-t border-foreground/10 bg-background">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-11 items-center justify-center text-sm"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
