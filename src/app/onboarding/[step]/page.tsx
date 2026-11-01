import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Placeholder } from "@/components/placeholder";
import { SETUP_STEPS, SetupShell } from "@/components/setup-shell";

// 5 steps per SRD §6 (FD-03); DB checks onboarding_step between 1 and 5.
export function generateStaticParams() {
  return Array.from({ length: SETUP_STEPS }, (_, i) => ({ step: String(i + 1) }));
}

export default function OnboardingStepPage({ params }: PageProps<"/onboarding/[step]">) {
  // params must be read inside Suspense for instant navigation (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-atmosphere min-h-dvh" />}>
      <Step params={params} />
    </Suspense>
  );
}

async function Step({ params }: Pick<PageProps<"/onboarding/[step]">, "params">) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > SETUP_STEPS) notFound();

  return (
    <SetupShell step={step}>
      <Placeholder title={`Step ${step}`} refs={`F-03 · FR-OB · step ${step}`} />
    </SetupShell>
  );
}
