import type { Risk } from "../api/types";

const dot = (sev: string) => (sev === "high" ? "var(--over)" : sev === "medium" ? "var(--warn)" : "var(--muted)");

export function RisksList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <div className="card ok">✓ No risks flagged</div>;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>Risks</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {risks.map((r, i) => (
          <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: ".25rem 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot(r.severity), marginTop: 6, flex: "0 0 auto" }} />
            <span><span className="muted" style={{ textTransform: "uppercase", fontSize: ".7rem" }}>{r.severity}</span> · {r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
