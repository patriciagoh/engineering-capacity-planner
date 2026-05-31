import type { Risk } from "../api/types";

export function RisksList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <div className="card fit-ok">✓ No risks flagged</div>;
  return (
    <div className="card">
      <h3>Risks</h3>
      <ul>
        {risks.map((r, i) => (
          <li key={i} className={r.severity === "high" ? "fit-risk" : undefined}>
            <strong>[{r.severity}]</strong> {r.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
