import { useId, type ReactNode } from "react";

export function Tooltip({ label, definition, dotted = true }: { label: ReactNode; definition: string; dotted?: boolean }) {
  const id = useId();
  return (
    <span className="relative inline-flex items-center group">
      <span
        tabIndex={0}
        aria-describedby={id}
        className={dotted ? "border-b border-dotted border-muted cursor-help" : "cursor-help"}
      >
        {label}
      </span>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 w-56 -translate-x-1/2 rounded-md p-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
      >
        {definition}
      </span>
    </span>
  );
}
