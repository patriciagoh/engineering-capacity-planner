import { useEffect, useState } from "react";
import { getOrg, getTeamPlan, getTeamRoster, postScenario } from "../api/client";
import type { Org, TeamPlan, TeamRoster } from "../api/types";
import { FitBar } from "../components/FitBar";
import { RosterTable } from "../components/RosterTable";
import { DeliverablesList } from "../components/DeliverablesList";
import { RisksList } from "../components/RisksList";
import { ScenarioPanel } from "../components/ScenarioPanel";

export function ManagerView() {
  const [org, setOrg] = useState<Org | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [roster, setRoster] = useState<TeamRoster | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrg().then((o) => {
      setOrg(o);
      if (o.teams[0]) setTeamId(o.teams[0].id);
    }).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!teamId) return;
    Promise.all([getTeamPlan(teamId), getTeamRoster(teamId)])
      .then(([p, r]) => { setPlan(p); setRoster(r); })
      .catch((e) => setError(String(e)));
  }, [teamId]);

  if (error) return <div className="fit-risk">{error}</div>;
  if (!org || !teamId || !plan || !roster) return <div>Loading…</div>;

  const ownedDeliverables = org.deliverables; // server already scopes via owners on the team in /plan
  return (
    <div>
      <label>
        Team:{" "}
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {org.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <h2>{plan.team_name}</h2>
      <FitBar plan={plan} />
      <RosterTable rows={roster.roster} />
      <DeliverablesList deliverables={ownedDeliverables} />
      <RisksList risks={plan.risks} />
      <ScenarioPanel teamId={teamId} onRun={postScenario} />
    </div>
  );
}
