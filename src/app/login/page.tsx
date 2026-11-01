import { Suspense } from "react";
import { Button, ButtonLink } from "@/components/button";
import { Logo } from "@/components/logo";
import { t, type MessageKey } from "@/lib/i18n";
import { sendMagicLink, signInWithGoogle } from "./actions";

const ERRORS: Record<string, MessageKey> = {
  generic: "login.error.generic",
  link: "login.error.link",
  email: "login.error.email",
};

// Login UI only (F-02); Google + magic-link logic is Harfi's (API_CONTRACT §3).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<div className="bg-atmosphere min-h-dvh" />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const q = await searchParams;

  return (
    <div className="bg-atmosphere flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-6">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        {q.sent ? (
          <section className="flex flex-col gap-4 rounded-card border border-border bg-white p-6 text-center">
            <span aria-hidden="true" className="mx-auto flex size-11 items-center justify-center rounded-full bg-powder text-xl text-blue">
              ✉
            </span>
            <h1 className="text-2xl font-semibold">{t("login.sentTitle")}</h1>
            <p className="text-muted">{t("login.sentBody")}</p>
            <ButtonLink href="/login" variant="text">
              {t("login.useAnother")}
            </ButtonLink>
          </section>
        ) : (
          <section className="flex flex-col gap-5 rounded-card border border-border bg-white p-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
              <p className="text-muted">{t("login.body")}</p>
            </div>

            {q.error && (
              <p role="alert" className="text-sm text-danger">
                {t(ERRORS[String(q.error)] ?? "login.error.generic")}
              </p>
            )}

            <form action={signInWithGoogle}>
              <Button type="submit">{t("login.google")}</Button>
            </form>

            <div className="flex items-center gap-3 text-xs font-medium text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              {t("login.or")}
              <span className="h-px flex-1 bg-border" />
            </div>

            <form action={sendMagicLink} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {t("login.email")}
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder={t("login.emailPlaceholder")}
                  className="h-13 rounded-control border border-border bg-white px-4 text-base font-normal placeholder:text-muted focus:outline-2 focus:outline-blue"
                />
              </label>
              <Button type="submit" variant="secondary">
                {t("login.send")}
              </Button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
