import { useState } from "react";
import type { Change, ScenarioResult } from "../api/types";

export function ScenarioPanel({
  teamId, onRun,
}: { teamId: string; onRun: (teamId: string, changes: Change[]) => Promise<ScenarioResult> }) {
  const [ktlo, setKtlo] = useState(0.4);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run() {
    setError(null); setPending(true);
    try {
      setResult(await onRun(teamId, [{ op: "set_reservation", team_id: teamId, name: "KTLO", fraction: ktlo }]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0, fontSize: ".95rem" }}>What-if · KTLO reservation</h3>
      <label className="muted" style={{ fontSize: ".82rem" }}>
        KTLO {Math.round(ktlo * 100)}%{" "}
        <input type="range" min={0} max={1} step={0.05} value={ktlo}
               onChange={(e) => setKtlo(Number(e.target.value))} style={{ accentColor: "var(--accent)", verticalAlign: "middle" }} />
      </label>
      <div style={{ marginTop: ".6rem" }}>
        <button className="btn" onClick={run} disabled={pending}>{pending ? "Running…" : "Apply scenario"}</button>
      </div>
      {result && (
        <div style={{ marginTop: ".6rem" }}>
          <span className={result.delta.net_pm >= 0 ? "pill pill-ok" : "pill pill-over"}>
            {result.delta.net_pm >= 0 ? "+" : ""}{result.delta.net_pm.toFixed(1)} PM net vs baseline
          </span>
        </div>
      )}
      {error && <div className="over" style={{ marginTop: ".6rem" }}>{error}</div>}
    </div>
  );
}
