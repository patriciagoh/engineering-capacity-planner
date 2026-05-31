import { useEffect, useState } from "react";
import { getGroupRollup, getOrg } from "../api/client";
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
    getGroupRollup(groupId).then(setRollup).catch((e) => setError(String(e)));
  }, [groupId]);

  if (error) return <div className="fit-risk">{error}</div>;
  if (!org || !groupId || !rollup) return <div>Loading…</div>;

  return (
    <div>
      <label>
        Group:{" "}
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {org.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <h2>{rollup.group_name}</h2>
      <div className="card">
        <strong>{rollup.total_net_pm.toFixed(1)} PM net</strong> vs{" "}
        <strong>{rollup.total_demand.expected.toFixed(1)} PM demand</strong> across{" "}
        {rollup.team_plans.length} teams
      </div>
      <table className="card">
        <thead><tr><th>Team</th><th>Net PM</th><th>Demand</th><th>Fit (expected)</th></tr></thead>
        <tbody>
          {rollup.team_plans.map((t) => (
            <tr key={t.team_id}>
              <td>{t.team_name}</td>
              <td>{t.net_pm.toFixed(1)}</td>
              <td>{t.demand.expected.toFixed(1)}</td>
              <td className={t.fit.is_oversubscribed_expected ? "fit-risk" : "fit-ok"}>
                {t.fit.expected_delta.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
