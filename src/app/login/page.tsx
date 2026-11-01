import { Suspense } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { sendMagicLink, signInWithGoogle } from "./actions";

const ERRORS: Record<string, MessageKey> = {
  generic: "login.error.generic",
  link: "login.error.link",
  email: "login.error.email",
};

async function Notice({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams;
  if (sent) return <p role="status" className="text-sm">{t("login.sent")}</p>;
  if (error) {
    return <p role="alert" className="text-sm text-red-600">{t(ERRORS[error] ?? "login.error.generic")}</p>;
  }
  return null;
}

// Functional login (F-02). Styling is owned by the frontend workstream (#16).
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
      <Suspense>
        <Notice searchParams={searchParams} />
      </Suspense>
      <form action={signInWithGoogle}>
        <button className="min-h-11 w-full rounded-lg bg-foreground px-4 py-3 font-medium text-background">
          {t("login.google")}
        </button>
      </form>
      <p className="text-center text-sm opacity-70">{t("login.or")}</p>
      <form action={sendMagicLink} className="flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={t("login.email")}
          aria-label={t("login.email")}
          className="min-h-11 rounded-lg border border-foreground/20 bg-transparent px-3"
        />
        <button className="min-h-11 rounded-lg border border-foreground/20 px-4 py-3 font-medium">
          {t("login.sendLink")}
        </button>
      </form>
    </main>
  );
}
