import { ButtonLink } from "@/components/button";
import { LandingHero } from "@/components/landing-hero";
import { Logo } from "@/components/logo";
import { FeatureDemo } from "@/components/feature-demo";
import { t, type MessageKey } from "@/lib/i18n";

// Mobile and desktop frames use different copy lengths.
function R({ k }: { k: string }) {
  return (
    <>
      <span className="lg:hidden">{t(k as MessageKey)}</span>
      <span className="max-lg:hidden">{t(`${k}Lg` as MessageKey)}</span>
    </>
  );
}

// Flagship feature (Figma "Flagship feature / n"): text + illustrative demo; actions lead to sign-in, "See a generated post" to /example (FD-32).
function Feature({ n, layout = "text-first", bg, dark }: { n: number; layout?: "text-first" | "media-first" | "center"; bg: string; dark?: boolean }) {
  const k = `landing.f${n}`;
  const center = layout === "center";
  const cta = (cls: string) => (
    <ButtonLink href={n === 2 ? "/example" : "/login"} variant="secondary" className={`${dark ? "bg-white! text-blue!" : ""} ${cls}`}>
      {t(`${k}Cta` as MessageKey)}
    </ButtonLink>
  );
  return (
    <section className={`landing-feature ${bg}`}>
      <div className={`mx-auto flex max-w-324 flex-col gap-8 px-5 py-12 lg:items-start lg:gap-12 lg:px-18 lg:py-16 ${center ? "lg:items-center" : layout === "media-first" ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
        <div className={`flex flex-col gap-4 leading-[1.4] lg:gap-[18px] ${center ? "lg:w-180 lg:items-center lg:text-center" : "lg:w-[40%] lg:max-w-120 lg:shrink-0"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
          <img src={`/figma/feature-${n}.svg`} width={n === 5 ? 136 : 132} height={n === 5 ? 74.8 : 48} alt="" className={`lg:order-last ${n === 5 ? "lg:h-22 lg:w-40" : "lg:h-16 lg:w-44"}`} />
          <p className={`text-xs font-semibold ${dark ? "text-white" : "text-blue"}`}>{t(`${k}Eyebrow` as MessageKey)}</p>
          <h2 className={`text-[26px] leading-[34px] font-semibold lg:text-[38px] lg:leading-[1.4] ${dark ? "text-white" : ""}`}>
            <R k={`${k}Title`} />
          </h2>
          <p className={`leading-6 lg:text-lg lg:leading-[1.4] ${dark ? "text-white" : "text-muted"}`}>
            <R k={`${k}Body`} />
          </p>
          {cta("max-lg:hidden lg:w-65")}
        </div>
        <figure className={`@container flex w-full flex-col gap-3.5 ${center ? "lg:max-w-275" : "lg:max-w-180 lg:flex-1"}`}>
          <FeatureDemo feature={n} />
          <figcaption className={`text-[11px] leading-[1.4] ${dark ? "text-white/80" : "text-muted"}`}>{t("landing.demoNote")}</figcaption>
        </figure>
        {cta("lg:hidden")}
      </div>
    </section>
  );
}

// Landing (Figma page 05, 228:16197 / 228:16254; SRD v2.1 A-01, A-02).
export default function LandingPage() {
  return (
    <div className="bg-app min-h-dvh">
      <header className="mx-auto flex h-16 max-w-360 items-center justify-between gap-4 px-5 lg:px-18">
        <Logo className="text-xl font-semibold! lg:text-[22px]" />
        <ButtonLink href="/login" className="h-10! w-25! text-sm! shadow-sm lg:w-35!">
          <span className="lg:hidden">{t("landing.signIn")}</span>
          <span className="max-lg:hidden">{t("landing.getStarted")}</span>
        </ButtonLink>
      </header>

      <main>
        <section className="relative overflow-hidden bg-linear-to-b from-[#06173b] via-[#1a3db2] via-65% to-[#617adb]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static design decoration */}
          <img src="/figma/landing-pink-light.svg" alt="" width={300} height={300} className="pointer-events-none absolute top-[510px] right-[-60px] size-75 lg:top-[497px] lg:right-[-100px] lg:h-[530px] lg:w-[680px]" />
          <div className="relative mx-auto flex max-w-360 flex-col items-center gap-6 px-5 py-12 text-center text-white lg:gap-7 lg:px-12 lg:pt-20 lg:pb-16">
            <h1 className="landing-headline max-w-[1100px] text-[46px] leading-[1.04] font-bold tracking-[-0.045em] whitespace-pre-line sm:text-[64px] lg:text-[94px] lg:leading-[1.02]">{t("landing.title")}</h1>
            <p className="max-w-[350px] leading-6 lg:max-w-190 lg:text-[17px] lg:leading-normal">
              <R k="landing.body" />
            </p>
            <ButtonLink href="/posts" className="landing-hero-cta max-w-[350px] border-white/80! bg-white! text-navy! font-bold! lg:w-75">
              {t("landing.cta")}
            </ButtonLink>
            <LandingHero />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto flex max-w-324 flex-col gap-4 px-5 pt-12 pb-10 leading-[1.4] lg:px-18 lg:pt-16 lg:pb-12">
          <h2 className="text-[27px] font-semibold lg:text-4xl">{t("landing.howTitle")}</h2>
          <p className="text-muted">{t("landing.howBody")}</p>
        </section>

        <Feature n={1} bg="bg-white/74" />
        <Feature n={2} layout="media-first" bg="bg-surface" />
        <Feature n={3} bg="bg-signature" />
        <Feature n={4} layout="media-first" bg="bg-white/74" />
        <Feature n={5} bg="bg-navy" dark />

        <section className="bg-powder">
          <div className="mx-auto flex max-w-324 flex-col gap-5 px-5 py-10 leading-[1.4] lg:px-18 lg:py-16">
            <h2 className="text-[28px] font-semibold lg:text-[38px]">{t("landing.promoteTitle")}</h2>
            <p className="text-[17px] text-muted">{t("landing.promoteBody")}</p>
            <ButtonLink href="/login" className="shadow-[0_6px_8px_rgb(36_86_219/13%)] lg:w-70">
              {t("landing.promoteCta")}
            </ButtonLink>
            <p className="text-xs text-muted">{t("landing.footer")}</p>
            {/* NFR-19 */}
            <p className="text-xs text-muted">{t("landing.builtWith")}</p>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-white px-5 py-10 lg:px-18">
        <div className="mx-auto flex max-w-288 flex-wrap items-center justify-between gap-6">
          <Logo />
          <nav aria-label={t("landing.footerNav")} className="flex flex-wrap gap-6 text-sm text-link">
            <a href="#how-it-works" className="flex min-h-11 items-center hover:underline">{t("landing.howTitle")}</a>
            <a href="/login" className="flex min-h-11 items-center hover:underline">{t("landing.signIn")}</a>
          </nav>
          <p className="text-xs text-muted">{t("landing.copyright")}</p>
        </div>
      </footer>
    </div>
  );
}
