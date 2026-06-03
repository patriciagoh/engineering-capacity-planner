export function FitBar({ supply, demand }: { supply: number; demand: number }) {
  const used = supply <= 0 ? 100 : Math.max(0, Math.min(100, (demand / supply) * 100));
  const over = demand > supply;
  const r = (n: number) => Number(n.toFixed(1));
  const label = over
    ? `oversubscribed: ${r(demand)} of ${r(supply)} pm`
    : `${r(demand)} of ${r(supply)} pm used`;
  return (
    <div role="img" aria-label={label} className="h-3 w-full rounded-pill bg-oat overflow-hidden border border-line">
      <div className="h-full" style={{ width: `${used}%`, background: over ? "var(--over-fill)" : "var(--good-fill)" }} />
    </div>
  );
}
