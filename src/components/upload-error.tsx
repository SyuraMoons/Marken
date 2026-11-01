import { Button } from "./button";
import { t } from "@/lib/i18n";

// One failed photo, the rest stay saved (97:2873, 98:1538).
export function UploadError({ onRetry, onChoose }: { onRetry: () => void; onChoose: () => void }) {
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-danger/10 text-danger">!</span>
        {t("uploadError.title")}
      </p>
      <p className="text-sm text-muted">{t("uploadError.body")}</p>
      <Button onClick={onRetry}>{t("uploadError.retry")}</Button>
      <Button variant="secondary" onClick={onChoose}>{t("uploadError.choose")}</Button>
    </section>
  );
}
