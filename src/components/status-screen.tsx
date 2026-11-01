import type { ReactNode } from "react";

// One layout for every post outcome: headline, body, next actions (FR-TD-04).
export function StatusScreen({ icon, title, body, children }: { icon: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-6">
        <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-powder text-xl text-blue">
          {icon}
        </span>
        <h1 className="text-2xl font-semibold lg:text-3xl">{title}</h1>
        <p className="text-muted">{body}</p>
      </div>
      {children}
    </section>
  );
}
