// Settings row: label left, current value muted, chevron (DX-06).
export function ListRow({ label, value, danger, onClick }: { label: string; value?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left focus-visible:outline-2 focus-visible:outline-blue ${danger ? "text-danger" : "text-ink"}`}
    >
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {value && <span className="text-sm text-muted">{value}</span>}
        <span aria-hidden="true" className="text-muted">
          ›
        </span>
      </span>
    </button>
  );
}
