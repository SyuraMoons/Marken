import { Button } from "./button";
import { InfoCard } from "./info-card";
import { t } from "@/lib/i18n";

// Upload failed (228:14208, 97:2873); retry sends the whole batch again.
export function UploadError({ onRetry, onChoose, pending = false }: { onRetry: () => void; onChoose: () => void; pending?: boolean }) {
  return (
    <div role="alert" className="flex flex-col gap-4">
      <InfoCard vector="photo" title={t("uploadError.title")}>
        {t("uploadError.body")}
      </InfoCard>
      <Button onClick={onRetry} disabled={pending} aria-busy={pending}>
        {t("uploadError.retry")}
      </Button>
      <Button variant="secondary" onClick={onChoose} disabled={pending}>
        {t("uploadError.choose")}
      </Button>
    </div>
  );
}
