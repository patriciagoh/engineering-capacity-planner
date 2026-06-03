import type { ReactNode } from "react";

export function DarkPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg p-5 ${className}`} style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}>
      {children}
    </div>
  );
}
