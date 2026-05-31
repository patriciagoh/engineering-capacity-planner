import { useState } from "react";
import type { Change, ScenarioResult } from "../api/types";

export function ScenarioPanel({
  teamId, onRun,
}: {
  teamId: string;
  onRun: (teamId: string, changes: Change[]) => Promise<ScenarioResult>;
}) {
  const [ktlo, setKtlo] = useState(0.4);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      const changes: Change[] = [
        { op: "set_reservation", team_id: teamId, name: "KTLO", fraction: ktlo },
      ];
      setResult(await onRun(teamId, changes));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <h3>What-if: KTLO reservation</h3>
      <label>
        KTLO {Math.round(ktlo * 100)}%{" "}
        <input type="range" min={0} max={1} step={0.05} value={ktlo}
          onChange={(e) => setKtlo(Number(e.target.value))} />
      </label>
      <div style={{ marginTop: 8 }}>
        <button onClick={run}>Apply scenario</button>
      </div>
      {result && (
        <div style={{ marginTop: 8 }} className={result.delta.net_pm >= 0 ? "fit-ok" : "fit-risk"}>
          {result.delta.net_pm >= 0 ? "+" : ""}{result.delta.net_pm.toFixed(1)} PM net vs baseline
        </div>
      )}
      {error && <div className="fit-risk" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
