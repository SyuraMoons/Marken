import type { ReactNode } from "react";

// One layout for every post outcome: title, body, then cards and actions (FR-TD-04, 2 Nov design).
export function StatusScreen({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="flex max-w-xl flex-col gap-5 leading-[1.4]">
      <h1 className="text-[30px] font-semibold">{title}</h1>
      <p className="text-muted">{body}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
