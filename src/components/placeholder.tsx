export function Placeholder({ title, refs }: { title: string; refs: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-2 px-4 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm opacity-70">Placeholder · {refs}</p>
    </main>
  );
}
