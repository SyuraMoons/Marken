import { Suspense } from "react";
import { redirect } from "next/navigation";
import { signOutToWelcome } from "@/app/login/actions";
import { AuthShell } from "@/components/auth-shell";
import { Button, ButtonLink } from "@/components/button";
import { InfoCard } from "@/components/info-card";
import { t } from "@/lib/i18n";
import { getOwnerShop } from "@/lib/data/today";

// Continue setup (228:17528, FR-OB-11/12, FR-LP-03): returning owner with unfinished setup lands here, not on a blank step.
export default function ResumePage() {
  return (
    <Suspense fallback={<div className="bg-app min-h-dvh" />}>
      <Resume />
    </Suspense>
  );
}

async function Resume() {
  const owner = await getOwnerShop();
  if (!owner) redirect("/login");
  const { shop } = owner;
  if (shop.onboarding_completed_at) redirect("/today");

  return (
    <AuthShell>
      <h1 className="text-[30px] font-semibold">{t("resume.title")}</h1>
      <p className="text-muted">{t("resume.body")}</p>
      <div className="flex flex-col gap-4 lg:max-w-136">
        <InfoCard vector="check" title={t("resume.cardTitle")}>
          {t("resume.cardBody")}
        </InfoCard>
        <ButtonLink href={`/onboarding/${shop.onboarding_step}`}>{t("resume.continue")}</ButtonLink>
        {/* A signed-in owner is sent away from "/", so leaving for the welcome page signs out first. */}
        <form action={signOutToWelcome} className="flex flex-col">
          <Button type="submit" variant="text">
            {t("resume.welcome")}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
