import { useEffect, useRef, useState } from "react";

export function EditableField({
  value, onCommit, ariaLabel, numeric = false, className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  numeric?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);

  const commit = () => { if (draft !== value) onCommit(draft); };

  return (
    <input
      ref={ref}
      className={`ecp-editable bg-transparent rounded-sm px-1 ${className}`}
      aria-label={ariaLabel}
      inputMode={numeric ? "decimal" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); ref.current?.blur(); }
        if (e.key === "Escape") { setDraft(value); ref.current?.blur(); }
      }}
    />
  );
}
