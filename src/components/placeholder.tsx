export function Placeholder({ title, refs }: { title: string; refs: string }) {
  return (
    <div className="flex flex-col gap-2 py-6">
      <h1 className="text-3xl font-semibold lg:text-4xl">{title}</h1>
      <p className="text-sm text-muted">Placeholder · {refs}</p>
    </div>
  );
}
