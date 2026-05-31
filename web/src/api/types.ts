export interface DemandRange { low: number; expected: number; high: number; }

export interface Fit {
  net_pm: number;
  demand: DemandRange;
  optimistic_delta: number;
  expected_delta: number;
  pessimistic_delta: number;
  is_oversubscribed_expected: boolean;
}

export interface Risk { kind: string; severity: "low" | "medium" | "high"; detail: string; }

export interface TeamPlan {
  team_id: string;
  team_name: string;
  gross_pm: number;
  net_pm: number;
  demand: DemandRange;
  fit: Fit;
  risks: Risk[];
}

export interface RosterRow {
  engineer_id: string;
  name: string;
  level: string;
  onboarding_state: string;
  availability: number;
  effective_capacity: number;
}

export interface TeamRoster { team_id: string; team_name: string; roster: RosterRow[]; }

export interface ScenarioResult {
  plan: TeamPlan;
  baseline: TeamPlan;
  delta: { gross_pm: number; net_pm: number; expected_delta: number };
}

export interface GroupRollup {
  group_id: string;
  group_name: string;
  total_gross_pm: number;
  total_net_pm: number;
  total_demand: DemandRange;
  fit: Fit;
  team_plans: TeamPlan[];
}

export interface OrgDeliverable {
  id: string; title: string; type: string; priority: number;
  owner_ids: string[]; estimate: Record<string, unknown>;
  target_sprint?: string | null;
  jira_epic?: string | null;
}

export interface OrgEngineer {
  id: string;
  name: string;
  level: string;
  onboarding_state: string;
  assignments: { team_id: string; availability: number }[];
}

export interface OrgTeam {
  id: string;
  name: string;
  productive_weeks: number;
  group_id: string | null;
}

export interface Org {
  teams: OrgTeam[];
  engineers: OrgEngineer[];
  deliverables: OrgDeliverable[];
  groups: { id: string; name: string; parent_id: string | null }[];
  quarter?: { id: string; label: string; as_of: string } | null;
}

export type Change = Record<string, unknown> & { op: string };
