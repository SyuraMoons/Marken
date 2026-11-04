import { notFound } from "next/navigation";
import { Placeholder } from "@/components/placeholder";

const STEPS = [
  "Welcome",
  "Shop basics",
  "Upload",
  "Review products",
  "Voice and rules",
  "Connect Instagram",
  "Notifications",
  "First post + tour",
] as const;

export function generateStaticParams() {
  return STEPS.map((_, i) => ({ step: String(i + 1) }));
}

export default async function OnboardingStepPage({
  params,
}: PageProps<"/onboarding/[step]">) {
  const { step } = await params;
  const index = Number(step) - 1;
  if (!(index in STEPS)) notFound();

  return (
    <Placeholder
      title={`Step ${index + 1} of ${STEPS.length}: ${STEPS[index]}`}
      refs={`F-03 · FR-OB-0${index + 1}`}
    />
  );
}
