import { Button } from "./button";
import { t } from "@/lib/i18n";

// Upload failed (97:2873, 98:1538); retry sends the whole batch again.
export function UploadError({ onRetry, onChoose, pending = false }: { onRetry: () => void; onChoose: () => void; pending?: boolean }) {
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-card border border-border bg-white p-5">
      <p className="flex items-center gap-2 font-semibold">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-danger/10 text-danger">!</span>
        {t("uploadError.title")}
      </p>
      <p className="text-sm text-muted">{t("uploadError.body")}</p>
      <Button onClick={onRetry} disabled={pending} aria-busy={pending}>{t("uploadError.retry")}</Button>
      <Button variant="secondary" onClick={onChoose} disabled={pending}>{t("uploadError.choose")}</Button>
    </section>
  );
}
