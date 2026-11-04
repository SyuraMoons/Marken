"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { CookingContent } from "./cooking-screen";

const subscribe = () => () => {};
export function CookingOverlay({ active, detail }: { active: boolean; detail?: string }) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!active || !node) return;
    node.showModal();
    return () => node.close();
  }, [active, hydrated]);
  if (!hydrated || !active) return null;
  return createPortal(
    <dialog ref={dialog} aria-label={t("loading.cooking")} onCancel={event => event.preventDefault()} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} className="bg-app cooking-dialog">
      <CookingContent detail={detail} />
    </dialog>,
    document.body,
  );
}

