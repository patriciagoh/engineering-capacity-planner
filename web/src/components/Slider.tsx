export function Slider({ value, onChange, ariaLabel, max = 30 }: { value: number; onChange: (v: number) => void; ariaLabel: string; max?: number }) {
  return (
    <input
      type="range" min={0} max={max} value={value} aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[color:var(--matcha)]"
    />
  );
}
