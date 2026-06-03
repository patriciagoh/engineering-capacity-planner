export function LoadBar({ name, pct, over }: { name: string; pct: number; over: boolean }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <div className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 py-1">
      <span className="text-sm text-ink-2 truncate">{name}</span>
      <div className="h-2.5 rounded-pill bg-oat overflow-hidden border border-line">
        <div className="h-full" style={{ width: `${width}%`, background: over ? "var(--over-fill)" : "var(--good-fill)" }} />
      </div>
      <span className={`font-mono text-xs text-right ${over ? "text-bad" : "text-muted"}`}>{Math.round(pct)}%</span>
    </div>
  );
}
