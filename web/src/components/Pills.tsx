export function Pills({ items, selected, onToggle }: { items: string[]; selected: number[]; onToggle: (i: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((label, i) => {
        const on = selected.includes(i);
        return (
          <button
            key={i}
            aria-pressed={on}
            onClick={() => onToggle(i)}
            className={`rounded-pill px-2.5 py-0.5 text-xs font-mono border transition-colors ${on ? "bg-matcha-tint border-matcha-tint-border text-matcha-deep" : "bg-oat border-line text-muted"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
