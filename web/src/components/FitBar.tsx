import type { TeamPlan } from "../api/types";

export function FitBar({ plan }: { plan: TeamPlan }) {
  const { net_pm, demand, fit } = plan;
  const over = fit.is_oversubscribed_expected;
  const scale = Math.max(net_pm, demand.high, 1);
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;
  return (
    <div className="card">
      <div className="tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.6rem" }}>
        <Tile label="Net PM" value={net_pm.toFixed(1)} />
        <Tile label="Demand" value={demand.expected.toFixed(1)} />
        <Tile label="Fit" value={(fit.expected_delta >= 0 ? "+" : "") + fit.expected_delta.toFixed(1)}
              cls={over ? "over" : "ok"} />
      </div>
      <div className="bar-track" style={{ margin: "0.8rem 0 0.4rem" }}>
        <div className="bar" style={{ width: pct(net_pm) }} />
      </div>
      <div className={over ? "over" : "ok"} style={{ fontSize: ".82rem" }}>
        {net_pm.toFixed(1)} PM net vs {demand.expected.toFixed(1)} PM demand
        {" · "}
        {over
          ? `⚠ ${Math.abs(fit.expected_delta).toFixed(1)} PM oversubscribed`
          : `✓ ${fit.expected_delta.toFixed(1)} PM headroom`}
        <span className="muted"> (range {demand.low.toFixed(1)}–{demand.high.toFixed(1)})</span>
      </div>
    </div>
  );
}

function Tile({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: ".55rem .7rem" }}>
      <div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div className={`num ${cls ?? ""}`} style={{ fontSize: "1.3rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
