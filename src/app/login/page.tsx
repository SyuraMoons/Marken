import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ButtonLink } from "@/components/button";
import { Field, glassInput } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { t, type MessageKey } from "@/lib/i18n";
import { resendMagicLink, sendMagicLink, signInWithGoogle, signInWithMeta } from "./actions";

const ERRORS: Record<string, MessageKey> = {
  generic: "login.error.generic",
  link: "login.error.link",
  email: "login.error.email",
};

const navy = "border-navy! bg-navy! gap-2.5";

// Sign in (F-02, Figma 228:16331 / 228:16374 / 228:16421 / 228:18304). Auth logic: API_CONTRACT §3, A-03.
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="bg-app min-h-dvh" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const q = await searchParams;

  // Check your inbox (228:16421)
  if (q.sent) {
    return (
      <AuthShell>
        <h1 className="text-[30px] font-semibold">{t("login.sentTitle")}</h1>
        <p className="text-muted">{t("login.sentBody")}</p>
        <section className="glass flex flex-col gap-3 rounded-card p-5 lg:max-w-136">
          {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
          <img src="/figma/vector-mail.svg" width={78} height={50.14} alt="" />
          <h2 className="text-lg font-semibold">{t("login.sentCard")}</h2>
          <p className="text-[15px] text-muted">{t("login.sentCardBody")}</p>
        </section>
        <form action={resendMagicLink} className="flex flex-col lg:max-w-136">
          <SubmitButton variant="secondary">{t("login.resend")}</SubmitButton>
        </form>
        <ButtonLink href="/login" variant="text" className="lg:max-w-136">
          {t("login.useAnother")}
        </ButtonLink>
      </AuthShell>
    );
  }

  // Sign-in interrupted (228:18304): Meta OAuth failed or was cancelled.
  if (q.error === "meta") {
    return (
      <AuthShell>
        <section className="flex flex-col gap-6 rounded-3xl bg-white px-6 pt-6 pb-8 lg:max-w-136">
          {/* eslint-disable-next-line @next/next/no-img-element -- Meta logo */}
          <img src="/figma/logo-meta-large.svg" width={80} height={80} alt="" />
          <h1 className="text-[28px] font-semibold">{t("login.metaRetryTitle")}</h1>
          <p className="text-[15px] text-muted">{t("login.metaRetryBody")}</p>
          <form action={signInWithMeta} className="flex flex-col">
            <SubmitButton pendingLabel={t("login.metaOpening")} className="shadow-[0_6px_8px_rgb(36_86_219/13%)]">
              {t("login.tryAgain")}
            </SubmitButton>
          </form>
          <ButtonLink href="/login" variant="text">
            {t("login.otherMethod")}
          </ButtonLink>
        </section>
      </AuthShell>
    );
  }

  // Sign in (228:16331)
  return (
    <AuthShell>
      <h1 className="text-[30px] font-semibold">{t("login.title")}</h1>
      <p className="text-muted">{t("login.body")}</p>
      {q.error && (
        <p role="alert" className="text-sm text-danger">
          {t(ERRORS[String(q.error)] ?? "login.error.generic")}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <form action={signInWithGoogle} className="flex flex-col">
          <SubmitButton className={navy}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Google logo */}
            <img src="/figma/logo-google.svg" width={24} height={24} alt="" />
            {t("login.google")}
          </SubmitButton>
        </form>
        <form action={signInWithMeta} className="flex flex-col">
          <SubmitButton className={navy} pendingLabel={t("login.metaOpening")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Meta logo */}
            <img src="/figma/logo-meta.svg" width={30} height={24} alt="" />
            {t("login.meta")}
          </SubmitButton>
        </form>
        <p className="text-center text-[13px] text-muted">{t("login.or")}</p>
        <form action={sendMagicLink} className="flex flex-col gap-4 lg:max-w-136">
          <Field n={1} cue="text" label={t("login.email")}>
            <input type="email" name="email" required autoComplete="email" placeholder={t("login.emailPlaceholder")} className={glassInput} />
          </Field>
          <SubmitButton className={navy}>{t("login.send")}</SubmitButton>
        </form>
        <section className="glass flex flex-col gap-3 rounded-card p-5 lg:order-last lg:mt-3 lg:max-w-136 lg:py-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- static design illustration */}
          <img src="/figma/login-product.svg" width={56} height={56} alt="" />
          <h2 className="text-lg font-semibold">{t("login.cardTitle")}</h2>
          <p className="text-[15px] text-muted">{t("login.cardBody")}</p>
        </section>
        <p className="text-[13px] text-muted">{t("login.igLater")}</p>
      </div>
    </AuthShell>
  );
}
