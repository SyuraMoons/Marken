import { ButtonLink } from "@/components/button";
import { Carousel } from "@/components/carousel";
import { Logo } from "@/components/logo";
import { ProductCheck } from "@/components/product-check";
import { t, type MessageKey } from "@/lib/i18n";
import { mockPost, mockProductPhoto } from "@/lib/mock";
import { allSlidesPassed, asSlides } from "@/lib/posts/slides";

const STEPS = [1, 2, 3] as const;

// Landing (F-01, FR-LP-01). One headline (DX-14), 3-step rows + before/after on the page (DX-15), compare CTA to /login (DX-04).
export default function LandingPage() {
  const slides = asSlides(mockPost.slides);

  return (
    <div className="bg-atmosphere flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Logo />
        <ButtonLink href="/login" variant="text" className="w-auto! px-2">
          {t("login.logIn")}
        </ButtonLink>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">{t("landing.title")}</h1>
          <p className="max-w-md text-ink/70">{t("landing.body")}</p>
          <div className="max-w-md">
            <ButtonLink href="/login">{t("landing.getStarted")}</ButtonLink>
          </div>

          <section aria-label={t("landing.how")} className="flex flex-col gap-3">
            {STEPS.map((n) => (
              <div key={n} className="flex gap-4 rounded-card border border-border bg-white p-4">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-powder text-sm font-semibold text-blue">
                  {n}
                </span>
                <div>
                  <h2 className="font-semibold">{t(`landing.step${n}` as MessageKey)}</h2>
                  <p className="text-sm text-muted">{t(`landing.step${n}Body` as MessageKey)}</p>
                </div>
              </div>
            ))}
          </section>
        </div>

        <section aria-label={t("landing.compare")} className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
          <Carousel slides={slides} labels={[t("today.slide1"), t("today.slide2"), t("today.slide3")]} />
          {allSlidesPassed(slides) && (
            <ProductCheck photo={mockProductPhoto} slide={slides[1]} labels={{ badge: t("today.badge"), before: t("today.before"), after: t("today.after") }} />
          )}
        </section>
      </main>

      <footer className="px-6 pb-6 text-center text-xs text-muted">{t("landing.footer")}</footer>
    </div>
  );
}
