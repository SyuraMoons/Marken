"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "./button";

export function CopyButton({ text, variant = "text", className }: { text: string; variant?: "text" | "secondary"; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
      aria-live="polite"
    >
      {copied ? t("common.copied") : t("common.copy")}
    </Button>
  );
}
