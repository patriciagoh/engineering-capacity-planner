import type { ReactNode } from "react";

export function StatRow({ term, value, info }: { term: string; value: ReactNode; info?: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-line last:border-0">
      <span className="text-sm text-ink-2 flex items-center gap-1">{term}{info}</span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  );
}
