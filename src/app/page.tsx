import Image from "next/image";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/button";
import { LandingHero } from "@/components/landing-hero";
import { Logo } from "@/components/logo";
import { Sprite } from "@/components/sprite";
import { t, type MessageKey } from "@/lib/i18n";

const PRODUCTS = "/figma/landing-products.png";
const COFFEE = "/figma/landing-coffee.png";
const BARS = ["h-[3em]", "h-[5.167em]", "h-[4.167em]", "h-[7.917em]", "h-[6.667em]", "h-[10em]", "h-[9em]"];

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
function Feature({ n, layout = "text-first", bg, dark, children }: { n: number; layout?: "text-first" | "media-first" | "center"; bg: string; dark?: boolean; children: ReactNode }) {
  const k = `landing.f${n}`;
  const center = layout === "center";
  const cta = (cls: string) => (
    <ButtonLink href={n === 2 ? "/example" : "/login"} variant="secondary" className={`${dark ? "bg-white! text-blue!" : ""} ${cls}`}>
      {t(`${k}Cta` as MessageKey)}
    </ButtonLink>
  );
  return (
    <section className={bg}>
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
          {/* Sizes are in em of 2cqw, so the demo scales with its column like the Figma frames (350 → 720 → 1100 px). */}
          <div
            aria-hidden="true"
            className="flex flex-col rounded-lg border-[0.083em] border-border bg-white text-[2cqw] leading-[1.4] gap-[1.333em] p-[2em] shadow-[0_0.667em_1.167em_rgb(31_56_128/10%)]"
          >
            <p className="text-[1.5em] font-semibold">{t(`${k}Demo` as MessageKey)}</p>
            {children}
          </div>
          <figcaption className={`text-[11px] leading-[1.4] ${dark ? "text-white/80" : "text-muted"}`}>{t("landing.demoNote")}</figcaption>
        </figure>
        {cta("lg:hidden")}
      </div>
    </section>
  );
}

const Tag = ({ k }: { k: string }) => (
  <div className="rounded-[0.833em] bg-powder p-[0.833em]">
    <p className="text-[1.167em] font-medium text-blue">{t(k as MessageKey)}</p>
  </div>
);

function Thumb({ src, i, aspect }: { src: string; i: number; aspect: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md ${aspect}`}>
      <Sprite src={src} i={i} sizes="(min-width: 1024px) 660px, 330px" />
    </div>
  );
}

// Landing (Figma page 05, 228:16197 / 228:16254; SRD v2.1 A-01, A-02).
export default function LandingPage() {
  return (
    <div className="bg-app min-h-dvh">
      <header className="mx-auto flex h-25 max-w-360 items-center justify-between gap-4 px-5 lg:px-18">
        <Logo className="text-2xl font-semibold! lg:text-[28px]" />
        <ButtonLink href="/login" className="w-[110px]! shadow-[0_6px_8px_rgb(36_86_219/13%)] lg:w-50!">
          <span className="lg:hidden">{t("landing.signIn")}</span>
          <span className="max-lg:hidden">{t("landing.getStarted")}</span>
        </ButtonLink>
      </header>

      <main>
        <section className="relative overflow-hidden bg-linear-to-b from-[#06173b] via-[#1a3db2] via-65% to-[#617adb]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static design decoration */}
          <img src="/figma/landing-pink-light.svg" alt="" width={300} height={300} className="pointer-events-none absolute top-[510px] right-[-60px] size-75 lg:top-[497px] lg:right-[-100px] lg:h-[530px] lg:w-[680px]" />
          <div className="relative mx-auto flex max-w-360 flex-col items-center gap-6 px-5 py-12 text-center text-white lg:gap-7 lg:px-12 lg:pt-20 lg:pb-16">
            <h1 className="max-w-[350px] text-[30px] leading-9 font-semibold whitespace-pre-line lg:max-w-240 lg:text-5xl lg:leading-14">{t("landing.title")}</h1>
            <p className="max-w-[350px] leading-6 lg:max-w-190 lg:text-[17px] lg:leading-normal">
              <R k="landing.body" />
            </p>
            <ButtonLink href="/login" className="max-w-[350px] shadow-[0_6px_8px_rgb(36_86_219/13%)] lg:w-65">
              {t("landing.cta")}
            </ButtonLink>
            <LandingHero />
          </div>
        </section>

        <section className="mx-auto flex max-w-324 flex-col gap-4 px-5 pt-12 pb-10 leading-[1.4] lg:px-18 lg:pt-16 lg:pb-12">
          <h2 className="text-[27px] font-semibold lg:text-4xl">{t("landing.howTitle")}</h2>
          <p className="text-muted">{t("landing.howBody")}</p>
        </section>

        <Feature n={1} bg="bg-white/74">
          <div className="grid grid-cols-3 gap-[1em]">
            {[0, 1, 2].map((i) => (
              <Thumb key={i} src={PRODUCTS} i={i} aspect="aspect-[102.667/105]" />
            ))}
          </div>
          <Tag k="landing.f1Tag" />
          <p className="text-[1.333em] text-muted">{t("landing.f1Note")}</p>
        </Feature>

        <Feature n={2} layout="center" bg="bg-[rgb(247_249_255/74%)] lg:bg-surface">
          <div className="grid grid-cols-3 gap-[1em]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-[0.667em]">
                <Thumb src={COFFEE} i={i} aspect="aspect-[4/5]" />
                <p className="text-[1.167em] text-muted">{t(`landing.f2Slide${i}` as MessageKey)}</p>
              </div>
            ))}
          </div>
          <Tag k="landing.f2Tag" />
        </Feature>

        <Feature n={3} bg="bg-white/74">
          <div className="flex items-start gap-[1.667em]">
            <div className="relative aspect-[128.333/151.667] w-[40%] shrink-0 overflow-hidden rounded-md">
              <Image src="/figma/landing-sneaker.png" alt="" fill sizes="(min-width: 1024px) 270px, 130px" className="object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[1.5em]">
              <p className="text-[1.333em] font-semibold">{t("landing.f3Caption")}</p>
              <p className="text-[1.417em] text-muted">{t("landing.f3CaptionText")}</p>
              <Tag k="landing.f3Tag" />
              <div className="flex h-[4.333em] w-[86%] items-center justify-center rounded-[1em] bg-blue">
                <p className="text-[1.333em] font-medium text-white">{t("landing.f3Button")}</p>
              </div>
            </div>
          </div>
          <p className="text-[1em] text-muted">{t("landing.f3Note")}</p>
        </Feature>

        <Feature n={4} layout="media-first" bg="bg-[rgb(247_249_255/74%)]">
          {(
            [
              ["◎", "f4Ig", "bg-powder"],
              ["f", "f4Fb", "bg-surface"],
            ] as const
          ).map(([glyph, key, tone]) => (
            <div key={key} className={`flex items-start gap-[1.333em] rounded-[1.333em] p-[1.5em] ${tone}`}>
              <p className="w-[1em] text-[2.667em] font-semibold text-blue">{glyph}</p>
              <div className="flex flex-col gap-[0.417em]">
                <p className="text-[1.583em] font-semibold">{t(`landing.${key}` as MessageKey)}</p>
                <p className="text-[1.25em] text-muted">{t(`landing.${key}Note` as MessageKey)}</p>
              </div>
            </div>
          ))}
          <p className="text-[1.25em] text-muted">{t("landing.f4Note")}</p>
          <div className="flex items-center gap-[1.714em] rounded-[1.714em] bg-surface p-[1.429em]">
            <div className="relative aspect-[52/60] w-[7.43em] shrink-0 overflow-hidden rounded-md">
              <Sprite src={PRODUCTS} i={2} sizes="(min-width: 1024px) 330px, 160px" />
            </div>
            <p className="text-[1.429em] font-medium whitespace-pre-line text-muted">{t("landing.f4Post")}</p>
          </div>
        </Feature>

        <Feature n={5} bg="bg-navy" dark>
          <div className="grid grid-cols-3 gap-[1em]">
            {(["f5Reach", "f5Saves", "f5Orders"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-[1em] rounded-[1em] bg-surface p-[1.167em]">
                <p className="text-[1.25em] text-muted">{t(`landing.${key}`)}</p>
                <p className="text-[2.5em] font-semibold">—</p>
              </div>
            ))}
          </div>
          <div className="flex min-h-[13.333em] items-end gap-[1.167em] bg-surface p-[1.667em]">
            {BARS.map((h) => (
              <div key={h} className={`w-[4.667em] rounded-[0.5em] bg-powder ${h}`} />
            ))}
          </div>
          <p className="text-[1.083em] text-muted">{t("landing.f5Note")}</p>
        </Feature>

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
    </div>
  );
}
