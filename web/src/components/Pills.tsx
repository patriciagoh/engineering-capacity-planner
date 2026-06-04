export function Pills({
  items, selected, onToggle,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ id, label }) => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            aria-pressed={on}
            onClick={() => onToggle(id)}
            className={`rounded-pill px-2.5 py-0.5 text-xs font-mono border transition-colors ${on ? "bg-matcha-tint border-matcha-tint-border text-matcha-deep" : "bg-oat border-line text-muted"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
