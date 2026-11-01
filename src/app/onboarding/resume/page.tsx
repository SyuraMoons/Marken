import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/button";
import { Logo } from "@/components/logo";
import { StatusScreen } from "@/components/status-screen";
import { SETUP_STEPS } from "@/components/setup-shell";
import { t, type MessageKey } from "@/lib/i18n";
import { getOwnerShop } from "@/lib/data/today";

// Resume (97:2638, FR-OB-11/12, FR-LP-03): returning owner with unfinished setup lands here, not on a blank step.
export default function ResumePage() {
  return (
    <Suspense fallback={<div className="bg-atmosphere min-h-dvh" />}>
      <Resume />
    </Suspense>
  );
}

async function Resume() {
  const owner = await getOwnerShop();
  if (!owner) redirect("/login");
  const { shop } = owner;
  if (shop.onboarding_completed_at) redirect("/today");
  const step = shop.onboarding_step;

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
            body={t("resume.body", { shop: shop.name ?? "", n: step, total: SETUP_STEPS, step: t(`setup.step${step}` as MessageKey) })}
          >
            <ButtonLink href={`/onboarding/${step}`}>{t("resume.continue")}</ButtonLink>
          </StatusScreen>
        </main>
      </div>
    </div>
  );
}
