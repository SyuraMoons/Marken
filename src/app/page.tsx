import { ButtonLink } from "@/components/button";
import { t } from "@/lib/i18n";

// Landing placeholder (F-01); the real page lands in the landing PR.
export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-4xl font-semibold">{t("app.name")}</h1>
      <p className="text-lg">{t("app.tagline")}</p>
      <ButtonLink href="/login">{t("landing.getStarted")}</ButtonLink>
    </main>
  );
}
