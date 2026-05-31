import type { GroupRollup, Org, ScenarioResult, TeamPlan, TeamRoster, Change } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJSON<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) throw new Error(await errorDetail(resp));
  return (await resp.json()) as T;
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(await errorDetail(resp));
  return (await resp.json()) as T;
}

async function errorDetail(resp: Response): Promise<string> {
  try {
    const body = await resp.json();
    return typeof body?.detail === "string" ? body.detail : `HTTP ${resp.status}`;
  } catch {
    return `HTTP ${resp.status}`;
  }
}

export const getOrg = () => getJSON<Org>("/org");
export const getTeamPlan = (teamId: string) => getJSON<TeamPlan>(`/teams/${teamId}/plan`);
export const getTeamRoster = (teamId: string) => getJSON<TeamRoster>(`/teams/${teamId}/roster`);
export const getGroupRollup = (groupId: string) => getJSON<GroupRollup>(`/groups/${groupId}/rollup`);
export const postScenario = (teamId: string, changes: Change[]) =>
  postJSON<ScenarioResult>(`/teams/${teamId}/scenario`, { changes });
