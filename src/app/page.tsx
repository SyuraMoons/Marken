import Link from "next/link";
import { t } from "@/lib/i18n";

// Landing page (F-01). Static; logged-in redirect (FR-LP-03) comes with auth.
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-4xl font-bold">{t("app.name")}</h1>
      <p className="text-lg">{t("app.tagline")}</p>
      <ol className="list-decimal pl-5 text-sm">
        <li>Learn your shop</li>
        <li>Find trends</li>
        <li>Approve and post</li>
      </ol>
      <Link
        href="/login"
        className="rounded-lg bg-foreground px-4 py-3 text-center font-medium text-background"
      >
        Get started
      </Link>
    </main>
  );
}
