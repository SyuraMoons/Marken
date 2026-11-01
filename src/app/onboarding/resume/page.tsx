import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/button";
import { Logo } from "@/components/logo";
import { StatusScreen } from "@/components/status-screen";
import { SETUP_STEPS } from "@/components/setup-shell";
import { t, type MessageKey } from "@/lib/i18n";
import { mockShop } from "@/lib/mock";

// Resume (97:2638, FR-OB-11/12, FR-LP-03): returning owner with unfinished setup lands here, not on a blank step.
export default function ResumePage({ searchParams }: PageProps<"/onboarding/resume">) {
  return (
    <Suspense fallback={<div className="bg-atmosphere min-h-dvh" />}>
      <Resume searchParams={searchParams} />
    </Suspense>
  );
}

async function Resume({ searchParams }: Pick<PageProps<"/onboarding/resume">, "searchParams">) {
  const q = await searchParams;
  const preview = process.env.NODE_ENV !== "production";
  // shortcut: dev-only ?step= preview, delete with the mocks.
  const wanted = preview ? Number(q.step) : NaN;
  const hasPreview = Number.isInteger(wanted) && wanted >= 1 && wanted <= SETUP_STEPS;
  const step = hasPreview ? wanted : mockShop.onboarding_step;
  // shortcut: mock reads, swap to the owner's shop row via the RLS server client.
  if (!hasPreview && mockShop.onboarding_completed_at) redirect("/today");

  return (
    <div className="bg-atmosphere flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-6">
        <header className="flex h-10 items-center">
          <Logo />
        </header>
        <main className="flex flex-1 flex-col justify-center py-10">
          <StatusScreen
            icon="✦"
            title={t("resume.title")}
            body={t("resume.body", { shop: mockShop.name ?? "", n: step, total: SETUP_STEPS, step: t(`setup.step${step}` as MessageKey) })}
          >
            <ButtonLink href={`/onboarding/${step}`}>{t("resume.continue")}</ButtonLink>
          </StatusScreen>
        </main>
      </div>
    </div>
  );
}
