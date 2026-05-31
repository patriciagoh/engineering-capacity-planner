import type { TeamPlan } from "../api/types";

export function FitBar({ plan }: { plan: TeamPlan }) {
  const { net_pm, demand, fit } = plan;
  const over = fit.is_oversubscribed_expected;
  const delta = fit.expected_delta;
  const scale = Math.max(net_pm, demand.high, 1);
  const pct = (v: number) => `${(Math.max(v, 0) / scale) * 100}%`;
  return (
    <div className="card">
      <div>
        <strong>{net_pm.toFixed(1)} PM net</strong> vs{" "}
        <strong>{demand.expected.toFixed(1)} PM demand</strong>{" "}
        <span>(range {demand.low.toFixed(1)}–{demand.high.toFixed(1)})</span>
      </div>
      <div className="bar-track" style={{ marginTop: 8 }}>
        <div className="bar" style={{ width: pct(net_pm) }} />
      </div>
      <div className={over ? "fit-risk" : "fit-ok"} style={{ marginTop: 8 }}>
        {over
          ? `⚠ ${Math.abs(delta).toFixed(1)} PM oversubscribed (expected)`
          : `✓ ${delta.toFixed(1)} PM headroom (expected)`}
        {` · pessimistic ${fit.pessimistic_delta.toFixed(1)} PM`}
      </div>
    </div>
  );
}
