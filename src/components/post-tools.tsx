"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";

// Save the generated images and remove the post. `downloads` are signed URLs with Content-Disposition: attachment.
// Delete asks twice inline (no browser dialogs) and then returns to History.
export function PostTools({ postId, downloads, canDelete, compact = false }: { postId: string; downloads: string[]; canDelete: boolean; compact?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const files = downloads.filter(Boolean);

  const saveAll = () => {
    files.forEach((href, i) => {
      // Browsers drop a burst of downloads, so they are staggered.
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = href;
        a.download = `slide-${i + 1}.png`;
        a.click();
      }, i * 400);
    });
  };

  const remove = () =>
    start(async () => {
      setError(false);
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" }).catch(() => null);
      if (res?.status === 401) return router.push("/login");
      if (!res?.ok) return setError(true);
      // On the list the card just disappears; on a post's own screen go back to the Today feed (same place as "Back to your posts").
      if (compact) router.refresh();
      else router.push("/posts");
    });

  return (
    <div className="flex flex-col gap-2.5">
      {files.length > 0 && (
        <>
          <Button variant="secondary" onClick={saveAll} className={compact ? "h-11! text-sm" : ""}>
            {t(compact ? "tools.download" : "tools.downloadAll")}
          </Button>
          {!compact && <ul className="grid grid-cols-3 gap-2">
            {files.map((href, i) => (
              <li key={href}>
                <a
                  href={href}
                  download={`slide-${i + 1}.png`}
                  className="flex h-11 items-center justify-center rounded-control border border-border bg-surface text-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-blue"
                >
                  {t("tools.downloadN", { n: i + 1 })}
                </a>
              </li>
            ))}
          </ul>}
        </>
      )}
      {canDelete &&
        (confirming ? (
          <div role="group" aria-label={t("tools.deleteTitle")} className="glass flex flex-col gap-2.5 rounded-card p-4 leading-[1.4]">
            <p className="text-sm font-semibold">{t("tools.deleteTitle")}</p>
            <p className="text-sm text-muted">{t("tools.deleteBody")}</p>
            <Button variant="danger" onClick={remove} disabled={pending} aria-busy={pending}>
              {t("tools.deleteConfirm")}
            </Button>
            <Button variant="text" onClick={() => setConfirming(false)} disabled={pending}>
              {t("tools.deleteKeep")}
            </Button>
            {error && (
              <p role="alert" className="text-center text-sm text-danger">
                {t("common.error")}
              </p>
            )}
          </div>
        ) : (
          <Button variant="text" className="text-danger!" onClick={() => setConfirming(true)}>
            {t("tools.delete")}
          </Button>
        ))}
    </div>
  );
}
