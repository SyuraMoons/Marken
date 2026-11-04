"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";

// POSTs to an SRD route, then re-reads the page; status changes only go through routes (FD-08).
export function ActionButton({
  url,
  body,
  variant,
  disabled,
  then,
  openPost,
  children,
}: {
  url: string;
  body?: unknown;
  variant?: "primary" | "secondary" | "text" | "danger";
  disabled?: boolean;
  then?: string;
  /** Open the post the route answers with ({ post: { id } }) on Today, e.g. after starting a new one. */
  openPost?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);

  const run = () =>
    start(async () => {
      setError(false);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }).catch(() => null);
      if (res?.status === 401) return router.push("/login");
      if (!res?.ok) return setError(true);
      if (then) return router.push(then);
      if (openPost) {
        const id = ((await res.json().catch(() => null)) as { post?: { id?: string } } | null)?.post?.id;
        if (id) return router.push(`/today?post=${id}`);
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-1">
      <Button variant={variant} onClick={run} disabled={disabled || pending} aria-busy={pending}>
        {children}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {t("common.error")}
        </p>
      )}
    </div>
  );
}
