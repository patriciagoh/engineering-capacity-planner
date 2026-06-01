import { useEffect, useState } from "react";
import { getGroupRollup, getOrg } from "../api";
import type { GroupRollup, Org } from "../api/types";

export function DirectorView() {
  const [org, setOrg] = useState<Org | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [rollup, setRollup] = useState<GroupRollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrg().then((o) => {
      setOrg(o);
      if (o.groups[0]) setGroupId(o.groups[0].id);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!groupId) return;
    setError(null);
    setRollup(null);
    let cancelled = false;
    getGroupRollup(groupId)
      .then((r) => { if (!cancelled) setRollup(r); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [groupId]);

  if (error) return <div className="fit-risk">{error}</div>;
  if (!org || !groupId || !rollup) return <div>Loading…</div>;

  return (
    <div>
      <label className="muted" style={{ fontSize: ".85rem" }}>
        Group:{" "}
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {org.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <h2 style={{ fontSize: "1.1rem" }}>{rollup.group_name}</h2>
      <div className="card tiles" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".6rem" }}>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Net PM</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.total_net_pm.toFixed(1)} PM net</div></div>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Demand</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.total_demand.expected.toFixed(1)}</div></div>
        <div><div className="muted" style={{ fontSize: ".65rem", textTransform: "uppercase" }}>Teams</div><div className="num" style={{ fontSize: "1.3rem", fontWeight: 700 }}>{rollup.team_plans.length}</div></div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Team</th><th>Net PM</th><th>Demand</th><th>Fit (expected)</th></tr></thead>
          <tbody>
            {rollup.team_plans.map((t) => (
              <tr key={t.team_id}>
                <td>{t.team_name}</td>
                <td className="num">{t.net_pm.toFixed(1)}</td>
                <td className="num">{t.demand.expected.toFixed(1)}</td>
                <td className={`num ${t.fit.is_oversubscribed_expected ? "over" : "ok"}`}>{t.fit.expected_delta.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
