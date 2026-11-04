"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// cacheComponents keeps visited routes alive in a hidden <Activity>, so a page's client state
// (an open "Add product" form, a create-flow step, a settings sub-view) survives switching tabs.
// Keying on bfcacheId remounts the page on every fresh navigation (nav links, router.push) while
// browser back/forward still restores it. Render it in the page itself so it reads the page's id.
export function FreshOnNavigate({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return (
    <div key={bfcacheId} className="contents">
      {children}
    </div>
  );
}
