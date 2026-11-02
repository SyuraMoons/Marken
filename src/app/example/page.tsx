import Image from "next/image";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { ButtonLink } from "@/components/button";
import { InfoCard } from "@/components/info-card";
import { t } from "@/lib/i18n";

function Shot({ eyebrow, caption }: { eyebrow: string; caption: string }) {
  return (
    <figure className="flex w-full flex-col gap-2 leading-[1.35] font-semibold lg:max-w-90">
      <div className="relative aspect-[4/5] overflow-hidden rounded-card">
        <Image src="/figma/photo-guide.png" alt="" fill sizes="(min-width: 1024px) 360px, 90vw" className="object-cover" />
      </div>
      <figcaption className="flex flex-col gap-2">
        <span className="text-[10px]">{eyebrow}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

// Public before/after example (Figma landing-compare 228:18221 / 228:18251; FR-LP-01). ?failed=1 adds the failed-check card.
export default function ExamplePage({ searchParams }: PageProps<"/example">) {
  return (
    <Suspense fallback={<div className="bg-app min-h-dvh" />}>
      <Example searchParams={searchParams} />
    </Suspense>
  );
}

async function Example({ searchParams }: Pick<PageProps<"/example">, "searchParams">) {
  const failed = (await searchParams).failed === "1";
  return (
    <AuthShell>
      <h1 className="text-[30px] font-semibold lg:text-2xl">{t("example.title")}</h1>
      <p className="text-muted lg:text-sm">{t("example.body")}</p>
      <div className="flex flex-col gap-6 lg:max-w-136">
        <Shot eyebrow={t("ob5.before")} caption={t("ob5.beforeCaption")} />
        <Shot eyebrow={t("ob5.after")} caption={t("ob5.afterCaption")} />
        <InfoCard vector="check" title={t("ob5.passedTitle")}>
          {t("ob5.passedBody")}
        </InfoCard>
        {failed && (
          <InfoCard vector="details" title={t("ob5.failedTitle")}>
            {t("ob5.failedBody")}
          </InfoCard>
        )}
        <ButtonLink href="/login">{t("example.start")}</ButtonLink>
        <ButtonLink href={failed ? "/example" : "/example?failed=1"} variant="text" scroll={false}>
          {t("ob5.viewFailed")}
        </ButtonLink>
        <ButtonLink href="/" variant="text">
          {t("example.back")}
        </ButtonLink>
      </div>
    </AuthShell>
  );
}
