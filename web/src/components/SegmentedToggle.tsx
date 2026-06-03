export function SegmentedToggle<T extends string>({
  options, value, onChange, ariaLabel,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-pill bg-oat p-1 border border-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-pill px-4 text-sm font-mono transition-colors ${active ? "bg-paper text-ink shadow-badge" : "text-muted"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
