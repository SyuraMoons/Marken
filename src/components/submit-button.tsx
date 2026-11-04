"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

// Form submit that disables itself and can show a pending label (e.g. "Opening Meta…").
export function SubmitButton({ pendingLabel, children, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
