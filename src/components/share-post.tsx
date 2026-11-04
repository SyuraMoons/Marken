"use client";

import { useEffect, useRef, useState } from "react";
import { t, type MessageKey } from "@/lib/i18n";
import { prepareShareFiles, sharePreparedFiles } from "@/lib/sharing/native";
import { Button } from "./button";

type State = "idle" | "preparing" | "ready" | "sharing" | "handed-off" | "unsupported" | "failed";

export function SharePost({ downloads, caption }: { downloads: string[]; caption: string }) {
  const [platform, setPlatform] = useState<"instagram" | "facebook">("instagram");
  const [state, setState] = useState<State>("idle");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [prepared, setPrepared] = useState<{ key: string; files: File[] }>({ key: "", files: [] });
  const abort = useRef<AbortController | null>(null);
  const captionInput = useRef<HTMLTextAreaElement>(null);
  const sourceKey = JSON.stringify(downloads);
  const ready = prepared.key === sourceKey && prepared.files.length === downloads.length && downloads.length > 0;
  useEffect(() => () => abort.current?.abort(), [sourceKey]);

  async function prepare() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState("preparing");
    setPrepared({ key: "", files: [] });
    try {
      const result = await prepareShareFiles(downloads, controller.signal);
      if (controller.signal.aborted) return;
      setPrepared({ key: sourceKey, files: result });
      setState(typeof navigator.share === "function" && navigator.canShare?.({ files: result }) ? "ready" : "unsupported");
    } catch {
      if (!controller.signal.aborted) setState("failed");
    }
  }

  async function share() {
    if (!ready) return;
    setState("sharing");
    try {
      const result = await sharePreparedFiles(prepared.files);
      setState(result === "cancelled" ? "ready" : result);
    } catch { setState("failed"); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }
  useEffect(() => {
    if (copyState === "failed") { captionInput.current?.focus(); captionInput.current?.select(); }
  }, [copyState]);

  const busy = state === "preparing" || state === "sharing";
  const statusKey: MessageKey | null = state === "failed" ? "nativeShare.failed" : state === "unsupported" ? "nativeShare.unsupported" : state === "handed-off" ? "nativeShare.handedOff" : null;
  return (
    <details data-tour="share" className="group rounded-card border border-border bg-surface/60">
      <summary className="flex min-h-13 cursor-pointer items-center justify-between gap-3 rounded-control bg-blue px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">{t("nativeShare.title")}<span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span></summary>
      <div className="flex flex-col gap-5 p-5 lg:p-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-ink">{t("nativeShare.title")}</h2>
        <p className="text-sm leading-5 text-muted">{t("nativeShare.body")}</p>
      </div>
      <fieldset className="flex flex-col gap-3 rounded-card bg-white p-4">
        <legend className="float-left w-full text-sm font-semibold">{t("nativeShare.instructions")}</legend>
        {(["instagram", "facebook"] as const).map((target) => (
          <label key={target} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-control p-3 ${platform === target ? "bg-powder" : "hover:bg-app"}`}>
            <input type="radio" name="share-platform" value={target} checked={platform === target} onChange={() => setPlatform(target)} className="sr-only peer" />
            {/* eslint-disable-next-line @next/next/no-img-element -- existing platform vectors from Figma */}
            <img src={`/figma/platform-${target}.svg`} width={28} height={28} alt="" />
            <span className="flex min-w-0 flex-1 flex-col gap-1 peer-focus-visible:outline-2 peer-focus-visible:outline-blue">
              <span className="text-sm font-semibold">{t(target === "instagram" ? "nativeShare.instagram" : "nativeShare.facebook")}</span>
              <span className="text-xs text-muted">{t(target === "instagram" ? "nativeShare.instagramHint" : "nativeShare.facebookHint")}</span>
            </span>
            {platform === target && <span aria-hidden="true" className="text-blue">✓</span>}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{t("nativeShare.step1")}</h3>
        <Button variant="secondary" onClick={copy}>{t(copyState === "copied" ? "nativeShare.copied" : "nativeShare.copy")}</Button>
        {copyState === "copied" && <p role="status" className="text-xs text-link">{t("nativeShare.copiedHint")}</p>}
        {copyState === "failed" && <>
          <p role="alert" className="text-sm text-muted">{t("nativeShare.copyFailed")}</p>
          <textarea ref={captionInput} aria-label={t("nativeShare.caption")} value={caption} readOnly onFocus={(e) => e.currentTarget.select()} className="min-h-28 w-full rounded-control border border-border bg-white p-3 text-sm text-ink" />
        </>}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{t("nativeShare.step2")}</h3>
        <p className="text-sm leading-5 text-muted">{t("nativeShare.prepareHint")}</p>
        <Button onClick={prepare} disabled={busy} aria-busy={state === "preparing"}>{t(state === "preparing" ? "nativeShare.preparing" : "nativeShare.prepare")}</Button>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{t("nativeShare.step3")}</h3>
        <p className="text-sm leading-5 text-muted">{t(platform === "instagram" ? "nativeShare.instagramSteps" : "nativeShare.facebookSteps")}</p>
        <Button onClick={share} disabled={!ready || busy || state === "unsupported"} aria-busy={state === "sharing"}>{t(state === "sharing" ? "nativeShare.opening" : "nativeShare.open")}</Button>
        <p className="text-xs leading-5 text-muted">{t("nativeShare.targets")}</p>
        {statusKey && <p role={state === "failed" ? "alert" : "status"} className="rounded-control bg-white p-3 text-sm leading-5 text-ink">{t(statusKey)}</p>}
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{t("nativeShare.download")}</h3>
        <p className="text-xs leading-5 text-muted">{t("nativeShare.downloadHint")}</p>
        <ol className="grid grid-cols-3 gap-2">
          {downloads.map((href, index) => <li key={`${index}-${href}`}><a href={href} download={`marken-slide-${index + 1}.png`} className="flex min-h-11 items-center justify-center rounded-control border border-border bg-white px-2 text-sm font-semibold text-link hover:bg-powder focus-visible:outline-2 focus-visible:outline-blue">{t("tools.downloadN", { n: index + 1 })}</a></li>)}
        </ol>
      </div>
      </div>
    </details>
  );
}
